import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ApiKeyScope {
  READ = 'READ',
  WRITE = 'WRITE',
  ADMIN = 'ADMIN',
}

@Entity('api_keys')
@Index(['keyHash'])
@Index(['organizationId', 'status'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'key_prefix', length: 8 })
  @Index()
  keyPrefix: string;

  @Column({ name: 'key_hash', unique: true })
  keyHash: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  @Index()
  status: ApiKeyStatus;

  @Column({
    type: 'simple-array',
    default: '',
  })
  scopes: string[];

  @Column({ type: 'simple-array', nullable: true })
  allowedIps: string[];

  @Column({ name: 'rate_limit', default: 1000 })
  rateLimit: number;

  @Column({ name: 'rate_limit_window', default: 3600 })
  rateLimitWindow: number; // in seconds

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'last_used_ip', nullable: true })
  lastUsedIp: string;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt: Date;

  @Column({ name: 'revoked_by', nullable: true })
  revokedBy: string;

  @Column({ name: 'revocation_reason', nullable: true })
  revocationReason: string;

  // Virtual property - the actual key is only shown once during creation
  plainTextKey?: string;

  /**
   * Generate a new API key
   */
  static generateKey(): { key: string; prefix: string; hash: string } {
    // Generate a secure random key
    const keyBytes = crypto.randomBytes(32);
    const key = `sk_${keyBytes.toString('base64url')}`;

    // Extract prefix for easy identification
    const prefix = key.substring(0, 8);

    // Hash the key for storage
    const hash = bcrypt.hashSync(key, 10);

    return { key, prefix, hash };
  }

  /**
   * Verify an API key against the hash
   */
  static verifyKey(plainKey: string, hash: string): boolean {
    return bcrypt.compareSync(plainKey, hash);
  }

  /**
   * Check if the key is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * Check if the key is active and valid
   */
  isValid(): boolean {
    return this.status === ApiKeyStatus.ACTIVE && !this.isExpired();
  }

  /**
   * Check if IP is allowed
   */
  isIpAllowed(ip: string): boolean {
    if (!this.allowedIps || this.allowedIps.length === 0) {
      return true; // No IP restrictions
    }

    return this.allowedIps.some((allowedIp) => {
      // Support CIDR notation in the future
      return allowedIp === ip;
    });
  }

  /**
   * Check if the key has a specific scope
   */
  hasScope(scope: string): boolean {
    return this.scopes.includes(scope) || this.scopes.includes(ApiKeyScope.ADMIN);
  }

  /**
   * Update usage statistics
   */
  recordUsage(ip: string): void {
    this.lastUsedAt = new Date();
    this.lastUsedIp = ip;
    this.usageCount++;
  }

  /**
   * Revoke the key
   */
  revoke(userId: string, reason: string): void {
    this.status = ApiKeyStatus.REVOKED;
    this.revokedAt = new Date();
    this.revokedBy = userId;
    this.revocationReason = reason;
  }

  /**
   * Mark as expired
   */
  @BeforeInsert()
  checkExpiration(): void {
    if (this.isExpired()) {
      this.status = ApiKeyStatus.EXPIRED;
    }
  }
}
