import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { DynamicConfigService } from '../../config/dynamic-config.service';

@Injectable()
export class SecretsHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(SecretsHealthIndicator.name);

  constructor(private readonly dynamicConfigService: DynamicConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.dynamicConfigService.isSecretsHealthy();

      if (isHealthy) {
        this.logger.debug('Secrets service is healthy');
        return this.getStatus(key, true, { status: 'up' });
      } else {
        this.logger.warn('Secrets service is unhealthy, falling back to environment variables');
        return this.getStatus(key, true, {
          status: 'fallback',
          message: 'Using environment variables',
        });
      }
    } catch (error) {
      this.logger.error('Secrets health check failed:', error);
      // Don't fail the health check if secrets are unavailable - we can fall back to env vars
      return this.getStatus(key, true, {
        status: 'fallback',
        error: error.message,
        message: 'Using environment variables',
      });
    }
  }

  /**
   * Test if critical secrets are accessible
   */
  async testCriticalSecrets(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test access to JWT secret
      const jwtSecret = await this.dynamicConfigService.get('JWT_SECRET');

      if (!jwtSecret) {
        throw new HealthCheckError('JWT_SECRET not found', {
          message: 'Critical JWT secret is not available',
        });
      }

      return this.getStatus(key, true, {
        status: 'up',
        criticalSecrets: 'accessible',
      });
    } catch (error) {
      this.logger.error('Critical secrets test failed:', error);
      throw new HealthCheckError('Critical secrets unavailable', {
        message: error.message,
      });
    }
  }
}
