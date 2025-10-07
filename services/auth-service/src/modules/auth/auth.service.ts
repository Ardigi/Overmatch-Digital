import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  EventType,
  type UserLoggedInEvent,
  type UserRegisteredEvent,
} from '@soc-compliance/events';
import {
  LoggingService,
  Metered,
  MetricsService,
  Observable,
  Traced,
  TracingService,
} from '@soc-compliance/monitoring';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { KeycloakService } from '../keycloak/keycloak.service';
import { MfaService } from '../mfa/mfa.service';
import { DeviceFingerprintService } from '../security/device-fingerprint.service';
import { SessionService } from '../sessions/session.service';
import { UsersService } from '../users/users.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { LoginEventType } from './entities/login-event.entity';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private refreshTokenService: RefreshTokenService,
    private mfaService: MfaService,
    private sessionService: SessionService,
    private deviceFingerprintService: DeviceFingerprintService,
    private anomalyDetectionService: AnomalyDetectionService,
    private keycloakService: KeycloakService,
    private eventEmitter: EventEmitter2,
    private metricsService: MetricsService,
    private tracingService: TracingService,
    private loggingService: LoggingService
  ) {}

  @Observable({ spanName: 'user-registration', metricName: 'auth_registration_duration_seconds' })
  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // For initial registration, create a default organization if not provided
    let organizationId = registerDto.organizationId;

    if (!organizationId) {
      // Check if this is the first user (admin setup)
      const userCount = await this.usersService.count();

      if (userCount === 0 && process.env.NODE_ENV === 'development') {
        // In development, use the setup endpoint for first user
        throw new BadRequestException('Please use POST /auth/setup to create the first admin user');
      }

      // For subsequent users in development, use a default organization
      if (process.env.NODE_ENV === 'development') {
        // Try to find the first organization
        const orgs = await this.usersService.findAll();
        if (orgs.length > 0 && orgs[0].organizationId) {
          organizationId = orgs[0].organizationId;
        }
      }

      if (!organizationId) {
        throw new BadRequestException('Organization ID is required');
      }
    }

    // Create user through UsersService (it will handle password hashing)
    const createUserDto = {
      email: registerDto.email,
      password: registerDto.password, // Pass raw password, UsersService will hash it
      firstName: registerDto.firstName || registerDto.profile?.firstName || '',
      lastName: registerDto.lastName || registerDto.profile?.lastName || '',
      organizationId,
    };

    const user = await this.usersService.create(createUserDto, null);

    // Emit user.registered event
    const userRegisteredEvent: UserRegisteredEvent = {
      id: uuidv4(),
      type: EventType.USER_REGISTERED,
      timestamp: new Date(),
      version: '1.0',
      source: 'auth-service',
      userId: user.id,
      organizationId: user.organizationId,
      payload: {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.roles?.[0] || 'user',
      },
    };

    this.eventEmitter.emit('user.registered', userRegisteredEvent);
    this.logger.log(`Emitted user.registered event for user ${user.id}`);

    return user;
  }

  @Observable({ spanName: 'user-login', metricName: 'auth_login_duration_seconds' })
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Temporary debug logging
    console.log('DEBUG - loginDto received:', JSON.stringify(loginDto, null, 2));
    console.log('DEBUG - email:', loginDto?.email, 'password length:', loginDto?.password?.length);
    
    try {
      // First, detect anomalies before checking credentials
      const loginContext = {
        email: loginDto.email,
        ipAddress,
        userAgent,
        deviceFingerprint: loginDto.deviceFingerprint,
        timestamp: new Date(),
      };

      // Check for credential stuffing and brute force attempts (pre-auth)
      console.log('DEBUG - Calling anomalyDetectionService.detectAnomalies...');
      let preAuthAnomalies;
      try {
        preAuthAnomalies = await this.anomalyDetectionService.detectAnomalies(loginContext);
        console.log('DEBUG - preAuthAnomalies result:', preAuthAnomalies);
      } catch (error) {
        console.error('ERROR in anomalyDetectionService.detectAnomalies:', error);
        this.logger.error('Anomaly detection failed during pre-auth', error.stack);
        // Continue without anomaly detection rather than failing login
        preAuthAnomalies = { shouldBlock: false, anomalies: [], requireMfa: false };
      }

    // Block if critical risk detected before auth
    if (preAuthAnomalies.shouldBlock && process.env.DISABLE_ANOMALY_BLOCKING !== 'true') {
      await this.anomalyDetectionService.recordLoginEvent(
        loginContext,
        LoginEventType.BLOCKED,
        preAuthAnomalies
      );
      throw new ForbiddenException(
        'Login blocked due to security concerns. Please contact support.'
      );
    }

    console.log('DEBUG - Calling usersService.findByEmail...');
    let user;
    try {
      user = await this.usersService.findByEmail(loginDto.email);
      console.log('DEBUG - User found:', user ? 'Yes' : 'No');
    } catch (error) {
      console.error('ERROR in usersService.findByEmail:', error);
      this.logger.error('Failed to find user by email', error.stack);
      throw new InternalServerErrorException('Failed to process login request');
    }

    if (!user) {
      // Record failed login attempt
      await this.anomalyDetectionService.recordLoginEvent(loginContext, LoginEventType.FAILED);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      // Record failed login attempt with user context
      await this.anomalyDetectionService.recordLoginEvent(
        { ...loginContext, userId: user.id },
        LoginEventType.FAILED
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification (skip in development for testing)
    // In production, strict email verification is required for SOC2 compliance
    if (!user.emailVerified && process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Please verify your email before logging in');
    }
    
    // Log warning in development when email is not verified
    if (!user.emailVerified && process.env.NODE_ENV === 'development') {
      this.logger.warn(`Allowing login for unverified email ${user.email} in development mode`);
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate device fingerprint if client data provided
    let deviceFingerprint: string | undefined;
    if (loginDto.deviceFingerprint && userAgent) {
      const fingerprint = this.deviceFingerprintService.generateFingerprint({
        userAgent,
        clientData: loginDto.deviceFingerprint,
      });
      deviceFingerprint = fingerprint.hash;

      // Update device info in session service
      await this.sessionService.updateDeviceInfo(user.id, fingerprint.hash, {
        fingerprint: fingerprint.hash,
        name: `${fingerprint.components.browser?.name || 'Unknown'} on ${fingerprint.components.os?.name || 'Unknown'}`,
        type: fingerprint.components.device?.type || 'desktop',
        os: fingerprint.components.os?.name,
        browser: fingerprint.components.browser?.name,
        lastSeen: new Date(),
        trusted: false,
        userAgent,
      });
    }

    // Now run full anomaly detection with user context
    const fullLoginContext = {
      ...loginContext,
      userId: user.id,
      deviceFingerprint: deviceFingerprint || loginContext.deviceFingerprint,
    };

    const anomalyResult = await this.anomalyDetectionService.detectAnomalies(fullLoginContext);

    // Block if critical risk detected
    if (anomalyResult.shouldBlock && process.env.DISABLE_ANOMALY_BLOCKING !== 'true') {
      await this.anomalyDetectionService.recordLoginEvent(
        fullLoginContext,
        LoginEventType.BLOCKED,
        anomalyResult
      );

      // Clear the user's sessions for security
      await this.sessionService.destroyAllUserSessions(user.id);

      throw new ForbiddenException(
        'Login blocked due to security concerns. Please contact support.'
      );
    }

    // Check if user has MFA enabled (skip in development for testing)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const skipMfaForTestUser = isDevelopment && user.email === 'admin@soc-compliance.com';

    console.log('DEBUG - Calling mfaService.getUserMFAStatus...');
    let mfaStatus;
    try {
      mfaStatus = await this.mfaService.getUserMFAStatus(user.id);
      console.log('DEBUG - MFA status:', mfaStatus);
    } catch (error) {
      console.error('ERROR in mfaService.getUserMFAStatus:', error);
      this.logger.error('Failed to get MFA status', error.stack);
      // Continue without MFA check
      mfaStatus = { enabled: false, enabledMethods: [] };
    }

    // Force MFA for high-risk logins even if not normally enabled
    const forceMfa = anomalyResult.requireMfa && !mfaStatus.enabled && !skipMfaForTestUser;

    if ((mfaStatus.enabled || forceMfa) && !loginDto.mfaToken && !skipMfaForTestUser) {
      // Record MFA required event
      await this.anomalyDetectionService.recordLoginEvent(
        fullLoginContext,
        LoginEventType.MFA_REQUIRED,
        anomalyResult
      );

      // Return indication that MFA is required
      return {
        requiresMfa: true,
        mfaMethods: mfaStatus.enabledMethods || ['totp'], // Default to TOTP if forced
        mfaSessionToken: await this.generateMfaSessionToken(user.id),
        securityNotice: forceMfa
          ? 'Additional verification required due to unusual login activity'
          : undefined,
      };
    }

    // Verify MFA token if provided
    if ((mfaStatus.enabled || forceMfa) && loginDto.mfaToken && !skipMfaForTestUser) {
      const mfaValid = await this.mfaService.verifyToken(user.id, loginDto.mfaToken);
      if (!mfaValid.valid) {
        // Record MFA failed event
        await this.anomalyDetectionService.recordLoginEvent(
          fullLoginContext,
          LoginEventType.MFA_FAILED,
          anomalyResult
        );
        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Create session
    console.log('DEBUG - Calling sessionService.createSession...');
    let sessionId;
    try {
      sessionId = await this.sessionService.createSession({
      userId: user.id,
      organizationId: user.organization?.id,
      email: user.email,
      roles: user.roles || ['user'],
      permissions: user.permissions || [],
      ipAddress,
      userAgent,
      deviceFingerprint,
      metadata: {
        sessionId: undefined, // Will be set after creation
      },
    });
      console.log('DEBUG - Session created with ID:', sessionId);
    } catch (error) {
      console.error('ERROR in sessionService.createSession:', error);
      this.logger.error('Failed to create session', error.stack);
      throw new InternalServerErrorException('Failed to create user session');
    }

    // Update session metadata with its own ID
    await this.sessionService.updateSessionData(sessionId, {
      metadata: { sessionId },
    });

    // Record successful login event
    await this.anomalyDetectionService.recordLoginEvent(
      { ...fullLoginContext, sessionId },
      LoginEventType.SUCCESS,
      anomalyResult
    );

    // Emit user.logged_in event
    const userLoggedInEvent: UserLoggedInEvent = {
      id: uuidv4(),
      type: EventType.USER_LOGGED_IN,
      timestamp: new Date(),
      version: '1.0',
      source: 'auth-service',
      userId: user.id,
      organizationId: user.organization?.id,
      payload: {
        userId: user.id,
        sessionId,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        mfaUsed: (mfaStatus.enabled || forceMfa) && !!loginDto.mfaToken,
      },
    };

    this.eventEmitter.emit('user.logged_in', userLoggedInEvent);
    this.logger.log(`Emitted user.logged_in event for user ${user.id}`);

    // Clear any failed login attempts after successful login
    await this.anomalyDetectionService.clearFailedAttempts(user.email);

    // ENTERPRISE AUTH: Authenticate against Keycloak and get Keycloak-issued tokens
    console.log('DEBUG - Authenticating user against Keycloak...');
    
    // First, try to authenticate
    let keycloakTokens = await this.keycloakService.authenticateUser(
      user.email,
      loginDto.password
    );
    
    // If authentication fails, try to sync the user to Keycloak (first-time login)
    if (!keycloakTokens) {
      console.log('DEBUG - User not in Keycloak, attempting to sync...');
      try {
        // Check if user exists in Keycloak
        const keycloakUser = await this.keycloakService.getUserByEmail(user.email);
        
        if (!keycloakUser) {
          // Create user in Keycloak with the same password
          console.log('DEBUG - Creating user in Keycloak...');
          await this.keycloakService.createUser({
            email: user.email,
            password: loginDto.password,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerified || process.env.NODE_ENV === 'development',
          });
          
          // Try to authenticate again
          keycloakTokens = await this.keycloakService.authenticateUser(
            user.email,
            loginDto.password
          );
        }
      } catch (syncError) {
        this.logger.error('Failed to sync user to Keycloak', syncError);
      }
    }
    
    if (!keycloakTokens) {
      // If still no tokens, authentication failed
      await this.anomalyDetectionService.recordLoginEvent(
        { ...fullLoginContext, userId: user.id },
        LoginEventType.FAILED
      );
      throw new UnauthorizedException('Authentication failed');
    }
    
    console.log('DEBUG - Keycloak authentication successful');
    
    // Store the Keycloak refresh token for later use
    // This allows us to refresh tokens and manage sessions
    // For now, we'll return the Keycloak refresh token directly
    // In production, you might want to encrypt/wrap this
    console.log('DEBUG - Using Keycloak tokens directly')
    
    const accessToken = keycloakTokens.accessToken;
    const refreshToken = keycloakTokens.refreshToken;
    const expiresIn = keycloakTokens.expiresIn;

    // Include security information in response if there were anomalies
    const response: any = {
      accessToken,
      refreshToken,
      expiresIn, // Use Keycloak's expiration time
      tokenType: keycloakTokens.tokenType || 'Bearer',
      sessionId, // Include session ID in response
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles || ['user'],
        organizationId: user.organization?.id,
      },
    };

    // Add security notice if there were non-blocking anomalies
    if (anomalyResult.anomalies.length > 0 && !anomalyResult.shouldBlock) {
      response.securityNotice = {
        message: 'Unusual login activity detected',
        anomalies: anomalyResult.anomalies.map((a) => ({
          type: a.type,
          description: a.description,
        })),
        recommendations: anomalyResult.actions
          .filter((a) => a.type === 'notify')
          .map((a) => a.reason),
      };
    }

    return response;
    } catch (error) {
      // Log the final error before it's thrown
      console.error('FINAL ERROR in login method:', error);
      this.logger.error('Login failed with error', error.stack);
      
      // Re-throw if it's already an HttpException
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Otherwise throw a generic internal server error
      throw new InternalServerErrorException('Login failed due to an internal error');
    }
  }

  /**
   * Validate a JWT token using Keycloak JWKS
   * SECURITY: This uses proper cryptographic verification with public keys
   */
  async validateToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string; roles?: string[]; error?: string }> {
    try {
      // Use Keycloak service for proper JWT validation with JWKS
      const validationResult = await this.keycloakService.validateToken(token);
      
      if (!validationResult.valid) {
        this.logger.warn(`Token validation failed: ${validationResult.error}`);
        return {
          valid: false,
          error: validationResult.error || 'Token validation failed',
        };
      }

      // Log successful validation for audit trail
      this.logger.log(`Token validated successfully for user: ${validationResult.email}`);
      
      return {
        valid: true,
        userId: validationResult.userId,
        email: validationResult.email,
        roles: validationResult.roles,
      };
    } catch (error) {
      this.logger.error('Token validation error', error);
      return {
        valid: false,
        error: 'Token validation failed',
      };
    }
  }

  @Traced('user-logout')
  async logout(userId: string, sessionId?: string) {
    // Get user info for event
    const user = await this.usersService.findOne(userId);

    // Revoke refresh tokens
    await this.refreshTokenService.revokeRefreshToken(userId);

    // Destroy session if provided
    if (sessionId) {
      await this.sessionService.destroySession(sessionId);
    } else {
      // Destroy all user sessions if no specific session provided
      await this.sessionService.destroyAllUserSessions(userId);
    }

    // Emit user.logged_out event
    if (user) {
      this.eventEmitter.emit('user.logged_out', {
        id: uuidv4(),
        type: EventType.USER_LOGGED_OUT,
        timestamp: new Date(),
        version: '1.0',
        source: 'auth-service',
        userId: user.id,
        organizationId: user.organizationId,
        payload: {
          userId: user.id,
          sessionId,
        },
      });
      this.logger.log(`Emitted user.logged_out event for user ${user.id}`);
    }
  }

  @Metered('auth_token_refresh_duration_seconds')
  async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // ENTERPRISE AUTH: Use Keycloak to refresh tokens
    const keycloakTokens = await this.keycloakService.refreshTokens(refreshToken);
    
    if (!keycloakTokens) {
      throw new UnauthorizedException('Failed to refresh token');
    }

    // Optionally validate the user is still active in our system
    // This is additional security on top of Keycloak
    try {
      const decodedToken = this.jwtService.decode(keycloakTokens.accessToken) as any;
      if (decodedToken && decodedToken.sub) {
        const user = await this.usersService.findOne(decodedToken.sub);
        if (user && user.status !== 'active') {
          throw new UnauthorizedException('User is not active');
        }
      }
    } catch (error) {
      this.logger.warn('Could not validate user status during token refresh', error);
      // Continue - Keycloak token is still valid
    }

    return {
      accessToken: keycloakTokens.accessToken,
      refreshToken: keycloakTokens.refreshToken,
      expiresIn: keycloakTokens.expiresIn,
      tokenType: keycloakTokens.tokenType || 'Bearer',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  private async generateTempToken(userId: string): Promise<string> {
    // Generate a temporary token for MFA verification
    const payload = {
      sub: userId,
      type: 'mfa_temp',
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: '5m',
    });
  }

  private async generateMfaSessionToken(userId: string): Promise<string> {
    // Generate a session token for MFA verification
    const payload = {
      sub: userId,
      type: 'mfa_required',
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: '5m',
    });
  }

  async seedInitialData() {
    this.logger.log('Starting seed data creation...');

    try {
      // Check if admin user already exists
      const existingAdmin = await this.usersService.findByEmail('admin@soc-compliance.com');
      if (existingAdmin) {
        return { message: 'Admin user already exists' };
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash('Admin@123!', 10);

      // Create the admin user directly
      const adminUser = await this.usersService.createFirstUser(
        'admin@soc-compliance.com',
        'Admin@123!',
        'SOC Compliance Platform'
      );

      this.logger.log('Seed data created successfully');
      return {
        message: 'Initial data seeded successfully',
        user: {
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
        },
      };
    } catch (error) {
      this.logger.error('Error seeding data:', error);
      throw new BadRequestException(`Failed to seed data: ${error.message}`);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user with password
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.usersService.updatePassword(userId, hashedPassword);

    // Invalidate all refresh tokens for security
    await this.refreshTokenService.revokeRefreshToken(userId);

    this.logger.log(`Password changed successfully for user ${userId}`);
  }
}
