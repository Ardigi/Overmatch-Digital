import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecretsManagerService } from '@soc-compliance/secrets';
import { randomBytes } from 'crypto';
import { DynamicConfigService } from '../../config/dynamic-config.service';

interface KeyRotationStatus {
  lastRotation: Date;
  nextRotation: Date;
  rotationCount: number;
  status: 'healthy' | 'warning' | 'error';
  currentKeyAge: number; // in days
}

@Injectable()
export class JwtRotationService implements OnModuleInit {
  private readonly logger = new Logger(JwtRotationService.name);
  private rotationStatus: KeyRotationStatus = {
    lastRotation: new Date(),
    nextRotation: new Date(),
    rotationCount: 0,
    status: 'healthy',
    currentKeyAge: 0,
  };

  constructor(
    private readonly dynamicConfigService: DynamicConfigService,
    private readonly jwtService: JwtService,
    @Optional() @Inject(SecretsManagerService) private readonly secretsManager?: SecretsManagerService
  ) {}

  async onModuleInit() {
    await this.updateRotationStatus();
    this.logger.log('JWT rotation service initialized');
  }

  /**
   * Run every day at 2 AM to check for key rotation
   */
  @Cron('0 2 * * *', {
    name: 'jwt-key-rotation-check',
    timeZone: 'UTC',
  })
  async checkKeyRotation() {
    this.logger.log('Running JWT key rotation check');

    try {
      const shouldRotate = await this.shouldRotateKey();

      if (shouldRotate) {
        await this.rotateJwtKey();
      } else {
        this.logger.log('JWT key rotation not needed at this time');
      }

      await this.updateRotationStatus();
    } catch (error) {
      this.logger.error('JWT key rotation check failed:', error);
      this.rotationStatus.status = 'error';
    }
  }

  /**
   * Force rotation of JWT key (for emergency use)
   */
  async rotateJwtKey(): Promise<boolean> {
    if (!this.secretsManager) {
      this.logger.warn('Secrets manager not available, cannot rotate JWT key');
      return false;
    }

    try {
      this.logger.log('Starting JWT key rotation');

      // Generate new JWT secret
      const newSecret = this.generateSecureKey();

      // Store the new secret
      await this.secretsManager.setSecret('JWT_SECRET', newSecret, {
        id: 'JWT_SECRET',
        description: 'JWT signing secret',
        tags: {
          service: 'auth-service',
          rotatedAt: new Date().toISOString(),
          rotationType: 'automatic',
        },
        ttl: 90 * 24 * 60 * 60, // 90 days
      });

      // Update rotation status
      this.rotationStatus.lastRotation = new Date();
      this.rotationStatus.nextRotation = this.calculateNextRotation();
      this.rotationStatus.rotationCount++;
      this.rotationStatus.status = 'healthy';
      this.rotationStatus.currentKeyAge = 0;

      this.logger.log('JWT key rotation completed successfully');
      return true;
    } catch (error) {
      this.logger.error('JWT key rotation failed:', error);
      this.rotationStatus.status = 'error';
      return false;
    }
  }

  /**
   * Check if JWT key should be rotated
   */
  private async shouldRotateKey(): Promise<boolean> {
    const nodeEnv = process.env.NODE_ENV;

    // Don't rotate in development or test environments
    if (nodeEnv !== 'production') {
      return false;
    }

    // Don't rotate if secrets manager is not available
    if (!this.secretsManager) {
      return false;
    }

    try {
      // Check if key exists in secrets manager
      const currentSecret = await this.secretsManager.getSecret('JWT_SECRET');
      if (!currentSecret) {
        this.logger.log('JWT secret not found in secrets manager, migration needed');
        return true;
      }

      // Check key age
      const metadata = await this.secretsManager.getSecretMetadata('JWT_SECRET');
      if (metadata && metadata.createdAt) {
        const keyAge = Date.now() - metadata.createdAt.getTime();
        const daysSinceCreation = keyAge / (1000 * 60 * 60 * 24);

        this.rotationStatus.currentKeyAge = daysSinceCreation;

        // Rotate every 30 days
        if (daysSinceCreation > 30) {
          this.logger.log(`JWT key is ${daysSinceCreation.toFixed(1)} days old, rotation needed`);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking if key rotation is needed:', error);
      return false;
    }
  }

  /**
   * Generate a cryptographically secure key
   */
  private generateSecureKey(): string {
    // Generate 256-bit (32 byte) random key
    const key = randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Calculate next rotation date
   */
  private calculateNextRotation(): Date {
    const nextRotation = new Date();
    nextRotation.setDate(nextRotation.getDate() + 30); // 30 days from now
    return nextRotation;
  }

  /**
   * Update rotation status
   */
  private async updateRotationStatus(): Promise<void> {
    try {
      if (this.secretsManager) {
        const metadata = await this.secretsManager.getSecretMetadata('JWT_SECRET');
        if (metadata && metadata.createdAt) {
          const keyAge = Date.now() - metadata.createdAt.getTime();
          this.rotationStatus.currentKeyAge = keyAge / (1000 * 60 * 60 * 24);

          // Update status based on key age
          if (this.rotationStatus.currentKeyAge > 45) {
            this.rotationStatus.status = 'error';
          } else if (this.rotationStatus.currentKeyAge > 35) {
            this.rotationStatus.status = 'warning';
          } else {
            this.rotationStatus.status = 'healthy';
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to update rotation status:', error);
    }
  }

  /**
   * Get current rotation status
   */
  getRotationStatus(): KeyRotationStatus {
    return { ...this.rotationStatus };
  }

  /**
   * Migrate JWT secret from environment to secrets manager
   */
  async migrateJwtSecret(): Promise<boolean> {
    if (!this.secretsManager) {
      this.logger.warn('Secrets manager not available, cannot migrate JWT secret');
      return false;
    }

    try {
      // Check if secret already exists in secrets manager
      const existingSecret = await this.secretsManager.getSecret('JWT_SECRET');
      if (existingSecret) {
        this.logger.log('JWT secret already exists in secrets manager');
        return true;
      }

      // Get secret from environment
      const envSecret = await this.dynamicConfigService.get('JWT_SECRET');
      if (!envSecret) {
        this.logger.error('JWT_SECRET not found in environment variables');
        return false;
      }

      // Migrate to secrets manager
      await this.secretsManager.setSecret('JWT_SECRET', envSecret, {
        id: 'JWT_SECRET',
        description: 'JWT signing secret (migrated from environment)',
        tags: {
          service: 'auth-service',
          migratedAt: new Date().toISOString(),
          source: 'environment',
        },
        ttl: 90 * 24 * 60 * 60, // 90 days
      });

      this.logger.log('JWT secret successfully migrated to secrets manager');
      return true;
    } catch (error) {
      this.logger.error('Failed to migrate JWT secret:', error);
      return false;
    }
  }
}
