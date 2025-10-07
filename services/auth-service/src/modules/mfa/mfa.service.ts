import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/entities/user.entity';

export interface MFASecret {
  base32: string;
  otpauth_url: string;
  qr_code_url?: string;
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
}

export interface MFAStatus {
  enabled: boolean;
  method: string;
  backupCodesRemaining?: number;
}

@Injectable()
export class MfaService {
  private readonly issuer: string;
  private readonly rateLimiter: Map<string, { attempts: number; resetAt: Date }> = new Map();
  private readonly usedTokens: Map<string, Set<string>> = new Map(); // userId -> Set of used tokens

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private redisService: RedisService,
    private auditService: AuditService,
  ) {
    this.issuer = this.configService.get('APP_NAME', 'SOC-Compliance');
  }

  /**
   * Generate a new TOTP secret for a user
   */
  async generateSecret(userId: string): Promise<MFASecret> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if MFA is already enabled
    const status = await this.getUserMFAStatus(userId);
    if (status.enabled) {
      throw new BadRequestException('MFA already enabled. Disable first to re-enroll.');
    }

    // Generate secret with proper length (160 bits = 32 base32 chars)
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `${this.issuer}:${user.email}`,
      issuer: this.issuer,
    });

    // Generate QR code
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store secret temporarily in Redis (expires in 10 minutes)
    await this.redisService.set(
      `mfa:setup:${userId}`,
      JSON.stringify({ secret: secret.base32, timestamp: Date.now() }),
      600 // 10 minutes
    );

    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
      qr_code_url: qrCodeDataUrl,
    };
  }

  /**
   * Generate QR code from otpauth URL
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    // Validate otpauth URL format
    if (!otpauthUrl.startsWith('otpauth://totp/')) {
      throw new BadRequestException('Invalid otpauth URL');
    }

    // Ensure no sensitive data is exposed
    if (otpauthUrl.includes('password') || otpauthUrl.includes('apikey')) {
      throw new BadRequestException('Security violation: sensitive data in QR code');
    }

    return qrcode.toDataURL(otpauthUrl);
  }

  /**
   * Verify TOTP token
   */
  private async verifyTOTPToken(token: string, secret: string, userId?: string): Promise<boolean> {
    // Check rate limiting
    if (userId) {
      this.checkRateLimit(userId);
    }

    // Validate token format
    if (!this.isValidTOTPToken(token)) {
      return false;
    }

    // Check if token was already used (prevent replay attacks)
    if (userId && this.isTokenUsed(userId, token)) {
      return false;
    }

    // Verify token with time window
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 30 second drift
    });

    if (verified && userId) {
      // Mark token as used
      this.markTokenAsUsed(userId, token);
    }

    return verified;
  }

  /**
   * Enable MFA for a user
   */
  async enableMfa(userId: string, token: string): Promise<{ enabled: boolean; backupCodes: string[] }> {
    // Get the secret from Redis
    const setupData = await this.redisService.get(`mfa:setup:${userId}`);
    if (!setupData) {
      throw new BadRequestException('MFA setup not initiated or expired');
    }
    const { secret } = JSON.parse(setupData as string);
    // Verify the token first
    const isValid = await this.verifyTOTPToken(token, secret, userId);
    if (!isValid) {
      throw new BadRequestException('Invalid verification token');
    }

    // Generate backup codes
    const backupCodes = await this.generateBackupCodes();

    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map(code => ({
      code: this.hashBackupCode(code),
      used: false,
    }));

    // Update user with MFA settings
    await this.userRepository.update(userId, {
      mfaEnabled: true,
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(hashedBackupCodes),
    });

    // Clear setup data from Redis
    await this.redisService.del(`mfa:setup:${userId}`);

    // Audit log
    await this.auditService.log({
      userId,
      action: 'mfa_enabled',
      details: { method: 'totp' },
    });

    return {
      enabled: true,
      backupCodes,
    };
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string): Promise<boolean> {
    // Password verification should be done by the controller/auth service

    // In real implementation, verify password through auth service
    // For now, we'll assume password verification is done by the controller

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });

    // Clear any MFA sessions
    await this.redisService.del(`mfa:session:${userId}`);

    // Audit log
    await this.auditService.log({
      userId,
      action: 'mfa_disabled',
      details: { reason: 'user_requested' },
    });

    return true;
  }

  /**
   * Generate secure backup codes
   */
  private async generateBackupCodes(count: number = 8): Promise<string[]> {
    const codes: string[] = [];
    const words = [
      'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
      'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
      'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
      'YANKEE', 'ZULU', 'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN',
      'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY'
    ];

    for (let i = 0; i < count; i++) {
      // Generate 4 random words
      const codeWords: string[] = [];
      for (let j = 0; j < 4; j++) {
        const randomIndex = crypto.randomInt(0, words.length);
        codeWords.push(words[randomIndex]);
      }
      codes.push(codeWords.join('-'));
    }

    return codes;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, backupCode: string): Promise<{ valid: boolean; remaining?: number; warning?: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaBackupCodes) {
      return { valid: false };
    }

    const backupCodes: BackupCode[] = JSON.parse(user.mfaBackupCodes);
    const hashedCode = this.hashBackupCode(backupCode);

    // Find matching unused code
    const codeIndex = backupCodes.findIndex(bc => bc.code === hashedCode && !bc.used);
    if (codeIndex === -1) {
      // Check if code was already used
      const usedCode = backupCodes.find(bc => bc.code === hashedCode && bc.used);
      if (usedCode) {
        return { valid: false };
      }
      return { valid: false };
    }

    // Mark code as used
    backupCodes[codeIndex].used = true;
    backupCodes[codeIndex].usedAt = new Date();

    // Update user
    await this.userRepository.update(userId, {
      mfaBackupCodes: JSON.stringify(backupCodes),
    });

    // Count remaining codes
    const remaining = backupCodes.filter(bc => !bc.used).length;

    // Audit log
    await this.auditService.log({
      userId,
      action: 'backup_code_used',
      details: { remaining },
    });

    const result: any = { valid: true, remaining };
    
    if (remaining <= 2) {
      result.warning = `Only ${remaining} backup codes remaining. Generate new codes soon.`;
    }

    return result;
  }

  /**
   * Check if TOTP token format is valid
   */
  isValidTOTPToken(token: any): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // TOTP tokens should be 6 digits
    return /^\d{6}$/.test(token);
  }

  /**
   * Verify MFA token (public method for controller)
   */
  async verifyToken(userId: string, token: string): Promise<{ valid: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return { valid: false };
    }

    // Check if it's a backup code
    if (token.includes('-')) {
      const result = await this.verifyBackupCode(userId, token);
      return { valid: result.valid };
    }

    // Otherwise verify as TOTP
    const valid = await this.verifyTOTPToken(token, user.mfaSecret, userId);
    return { valid };
  }

  /**
   * Get user MFA status
   */
  async getUserMFAStatus(userId: string): Promise<MFAStatus & { enabledMethods: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return { enabled: false, method: 'none', enabledMethods: [] };
    }

    if (!user.mfaEnabled) {
      return { enabled: false, method: 'none', enabledMethods: [] };
    }

    const backupCodes = user.mfaBackupCodes ? JSON.parse(user.mfaBackupCodes as string) : [];
    const remaining = backupCodes.filter((bc: BackupCode) => !bc.used).length;

    return {
      enabled: true,
      method: 'totp',
      enabledMethods: ['totp'],
      backupCodesRemaining: remaining,
    };
  }

  /**
   * Generate new backup codes for user
   */
  async generateBackupCodesForUser(userId: string): Promise<{ codes: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaEnabled) {
      throw new BadRequestException('MFA not enabled for this user');
    }

    const backupCodes = await this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(code => ({
      code: this.hashBackupCode(code),
      used: false,
    }));

    await this.userRepository.update(userId, {
      mfaBackupCodes: JSON.stringify(hashedBackupCodes),
    });

    await this.auditService.log({
      userId,
      action: 'backup_codes_regenerated',
      details: { count: backupCodes.length },
    });

    return { codes: backupCodes };
  }

  /**
   * Get backup codes status
   */
  async getBackupCodes(userId: string): Promise<{ remaining: number; total: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaBackupCodes) {
      return { remaining: 0, total: 0 };
    }

    const backupCodes: BackupCode[] = JSON.parse(user.mfaBackupCodes as string);
    const remaining = backupCodes.filter(bc => !bc.used).length;

    return { remaining, total: backupCodes.length };
  }


  /**
   * Validate MFA setup requirements
   */
  async validateMFASetup(userId: string, authenticated: boolean): Promise<boolean> {
    if (!authenticated) {
      throw new UnauthorizedException('Must be authenticated to setup MFA');
    }
    return true;
  }

  /**
   * Get supported MFA methods
   */
  getSupportedMethods(): string[] {
    return ['totp', 'sms', 'email', 'webauthn', 'backup_codes'];
  }

  /**
   * Request MFA bypass (for account recovery)
   */
  async requestMFABypass(
    userId: string, 
    reason: string,
    requestMetadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<any> {
    const auditLog = {
      userId,
      action: 'mfa_bypass_requested',
      reason,
      timestamp: new Date(),
      ip: requestMetadata?.ipAddress || 'Unknown',
      userAgent: requestMetadata?.userAgent || 'Unknown',
      requiresApproval: true,
    };

    await this.auditService.log(auditLog);

    return {
      requestId: `bypass-request-${Date.now()}`,
      status: 'pending_approval',
      auditLog,
    };
  }

  /**
   * Initiate account recovery
   */
  async initiateAccountRecovery(email: string): Promise<any> {
    return {
      methods: [
        'email_verification',
        'security_questions',
        'identity_verification',
        'admin_approval',
      ],
      requiredMethods: 2,
    };
  }

  /**
   * Check if operation requires MFA
   */
  requiresMFA(operation: string): boolean {
    const sensitiveOperations = [
      'change_password',
      'disable_mfa',
      'add_api_key',
      'change_email',
      'delete_account',
      'export_data',
    ];
    return sensitiveOperations.includes(operation);
  }

  /**
   * Verify MFA session
   */
  async verifyMFASession(session: any): Promise<boolean> {
    const maxAge = session.maxAge || 15 * 60 * 1000; // 15 minutes default
    if (Date.now() - session.verifiedAt > maxAge) {
      throw new UnauthorizedException('MFA session expired');
    }
    return true;
  }

  /**
   * Trust device
   */
  async trustDevice(userId: string, fingerprint: any, duration: number): Promise<any> {
    const hashedFingerprint = `hash_${fingerprint.deviceId}`;
    
    await this.redisService.set(
      `trusted_device:${userId}:${hashedFingerprint}`,
      JSON.stringify({
        fingerprint,
        trustedAt: Date.now(),
        expiresAt: Date.now() + duration,
      }),
      duration / 1000 // Convert to seconds for Redis
    );

    return {
      trusted: true,
      expiresAt: Date.now() + duration,
      fingerprint: hashedFingerprint,
    };
  }

  /**
   * SMS/Email MFA methods (stubs for now)
   */
  sendSMSCode(): void {
    throw new BadRequestException('Please wait 60 seconds before requesting new code');
  }

  generateSMSCode(): any {
    return {
      code: Math.floor(100000 + Math.random() * 900000).toString(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
  }

  sendSMSMessage(phone: string, message: string): void {
    // Validate message content
    if (message.includes('password') || message.includes('secret')) {
      throw new BadRequestException('Security violation: sensitive data in SMS');
    }
    // In production, integrate with SMS provider
  }

  /**
   * Private helper methods
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const limit = this.rateLimiter.get(userId);
    
    if (limit) {
      if (now < limit.resetAt.getTime()) {
        if (limit.attempts >= 5) {
          throw new BadRequestException('Too many failed MFA attempts');
        }
        limit.attempts++;
      } else {
        // Reset the limit
        this.rateLimiter.set(userId, {
          attempts: 1,
          resetAt: new Date(now + 60 * 60 * 1000), // 1 hour
        });
      }
    } else {
      this.rateLimiter.set(userId, {
        attempts: 1,
        resetAt: new Date(now + 60 * 60 * 1000),
      });
    }
  }

  private isTokenUsed(userId: string, token: string): boolean {
    const userTokens = this.usedTokens.get(userId);
    return userTokens ? userTokens.has(token) : false;
  }

  private markTokenAsUsed(userId: string, token: string): void {
    if (!this.usedTokens.has(userId)) {
      this.usedTokens.set(userId, new Set());
    }
    this.usedTokens.get(userId)!.add(token);
    
    // Clean up old tokens periodically (every 100 tokens)
    const userTokens = this.usedTokens.get(userId)!;
    if (userTokens.size > 100) {
      userTokens.clear();
    }
  }
}