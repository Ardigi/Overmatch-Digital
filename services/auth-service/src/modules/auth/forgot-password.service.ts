import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { PasswordPolicyService } from './password-policy.service';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class ForgotPasswordService {
  private readonly logger = new Logger(ForgotPasswordService.name);
  private readonly tokenExpiration = 60 * 60 * 1000; // 1 hour

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private passwordPolicyService: PasswordPolicyService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Initiate password reset (alias for controller compatibility)
   */
  async initiatePasswordReset(email: string): Promise<void> {
    return this.requestPasswordReset(email);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: ['organization'],
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`Password reset requested for inactive user: ${email}`);
      return;
    }

    // Check if there's a recent reset request
    if (user.resetPasswordExpires && 
        user.resetPasswordExpires > new Date() &&
        user.resetPasswordExpires.getTime() - Date.now() > 55 * 60 * 1000) {
      throw new BadRequestException('Password reset already requested. Please check your email or try again later.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save hashed token with expiration
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + this.tokenExpiration);

    await this.userRepository.save(user);

    // Generate reset link
    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    // Emit event for notification service
    this.eventEmitter.emit('password.reset.requested', {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      resetToken: hashedToken,
      resetLink,
      expiresAt: user.resetPasswordExpires,
    });

    this.logger.log(`Password reset requested for user ${user.email}`);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with matching token that hasn't expired
    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: hashedToken,
      },
      relations: ['organization'],
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Validate new password against policy
    const passwordPolicy = this.passwordPolicyService.getPolicy(user.organization);
    const passwordValidation = await this.passwordPolicyService.validatePassword(
      newPassword,
      passwordPolicy,
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        previousPasswords: user.previousPasswords,
      },
    );

    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Add current password to history if enabled
    if (passwordPolicy.enablePasswordHistory && user.password) {
      if (!user.previousPasswords) {
        user.previousPasswords = [];
      }
      user.previousPasswords.push(user.password);
      
      // Keep only the last N passwords as per policy
      if (user.previousPasswords.length > passwordPolicy.passwordHistoryCount) {
        user.previousPasswords = user.previousPasswords.slice(-passwordPolicy.passwordHistoryCount);
      }
    }

    // Update user
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    await this.userRepository.save(user);

    // Revoke all refresh tokens for security
    await this.refreshTokenService.revokeRefreshToken(user.id);

    // Emit event
    this.eventEmitter.emit('password.reset.completed', {
      userId: user.id,
      organizationId: user.organizationId,
      changedBy: user,
    });

    this.logger.log(`Password reset completed for user ${user.email}`);
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.userRepository.findOne({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    return !!(user && 
              user.resetPasswordExpires && 
              user.resetPasswordExpires > new Date());
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password against policy
    const passwordPolicy = this.passwordPolicyService.getPolicy(user.organization);
    const passwordValidation = await this.passwordPolicyService.validatePassword(
      newPassword,
      passwordPolicy,
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        previousPasswords: user.previousPasswords,
      },
    );

    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Add current password to history if enabled
    if (passwordPolicy.enablePasswordHistory && user.password) {
      if (!user.previousPasswords) {
        user.previousPasswords = [];
      }
      user.previousPasswords.push(user.password);
      
      // Keep only the last N passwords as per policy
      if (user.previousPasswords.length > passwordPolicy.passwordHistoryCount) {
        user.previousPasswords = user.previousPasswords.slice(-passwordPolicy.passwordHistoryCount);
      }
    }

    // Update user
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Emit event
    this.eventEmitter.emit('password.changed', {
      userId: user.id,
      organizationId: user.organizationId,
      changedBy: user,
    });

    this.logger.log(`Password changed for user ${user.email}`);
  }
}