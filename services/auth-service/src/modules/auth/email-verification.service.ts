import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly tokenExpiration = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate email verification token and save to user
   */
  async generateVerificationToken(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Store hashed token with expiration
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + this.tokenExpiration);

    await this.userRepository.save(user);

    // Generate verification link
    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const verificationLink = `${baseUrl}/auth/verify-email?token=${token}`;

    // Emit event for notification service
    this.eventEmitter.emit('email.verification.requested', {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      verificationToken: hashedToken,
      verificationLink,
      expiresAt: user.resetPasswordExpires,
    });

    this.logger.log(`Email verification requested for user ${user.email}`);

    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
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
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Update user
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    // Activate user if they were pending
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.save(user);

    // Emit event
    this.eventEmitter.emit('email.verified', {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
    });

    this.logger.log(`Email verified for user ${user.email}`);

    return { 
      success: true, 
      message: 'Email verified successfully' 
    };
  }

  /**
   * Resend verification email by user ID
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    await this.resendVerification(userId);
  }

  /**
   * Resend verification email
   */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Check if there's a recent verification request
    // Using resetPasswordExpires as a temporary field until we add proper email verification tracking
    if (user.resetPasswordExpires && 
        user.resetPasswordExpires > new Date() &&
        user.resetPasswordExpires.getTime() - Date.now() > 23 * 60 * 60 * 1000) {
      throw new BadRequestException('A verification email was recently sent. Please check your email or wait before requesting another.');
    }

    await this.generateVerificationToken(userId);
  }

  /**
   * Check if user's email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['emailVerified'],
    });

    return user?.emailVerified || false;
  }

  /**
   * Send verification email for new user
   */
  async sendVerificationEmail(user: User): Promise<void> {
    if (user.emailVerified) {
      return;
    }

    await this.generateVerificationToken(user.id);
  }
}