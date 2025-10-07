import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import {
  SecretsHealthCheckService,
  SecretsHealthStatus,
} from '../secrets-health-check.service';
import { SecretsMonitoringService } from '../secrets-monitoring.service';

@Controller('health/secrets')
export class SecretsHealthController {
  constructor(
    private readonly healthCheckService: SecretsHealthCheckService,
    private readonly monitoringService: SecretsMonitoringService
  ) {}

  /**
   * Get overall secrets management health status
   */
  @Get()
  async getHealth(): Promise<SecretsHealthStatus> {
    try {
      return await this.healthCheckService.checkOverallHealth();
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Health check failed',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get detailed health status with metrics
   */
  @Get('detailed')
  async getDetailedHealth(): Promise<{
    health: SecretsHealthStatus;
    metrics: {
      totalAccess: number;
      successRate: number;
      rotationsDue: number;
      expiredSecrets: number;
      providerHealth: Record<string, boolean>;
      cacheHitRatio: number;
      securityViolations: number;
    };
  }> {
    try {
      const [health, metrics] = await Promise.all([
        this.healthCheckService.checkOverallHealth(),
        this.monitoringService.getSecretsHealthSummary(),
      ]);

      return { health, metrics };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Detailed health check failed',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get health status for a specific provider
   */
  @Get('providers/:provider')
  async getProviderHealth(provider: string): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    details: Record<string, any>;
    lastChecked: Date;
  }> {
    try {
      const health = await this.healthCheckService.checkOverallHealth();
      const providerHealth = health.providers.find((p) => p.name === provider);

      if (!providerHealth) {
        throw new HttpException(
          {
            status: HttpStatus.NOT_FOUND,
            error: 'Provider not found',
            message: `Provider '${provider}' is not registered`,
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        status: providerHealth.status,
        details: providerHealth.details,
        lastChecked: providerHealth.timestamp,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Provider health check failed',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Simple readiness probe
   */
  @Get('ready')
  async getReadiness(): Promise<{ status: string; timestamp: Date }> {
    try {
      const health = await this.healthCheckService.checkOverallHealth();

      if (health.overall === 'unhealthy') {
        throw new HttpException(
          {
            status: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service not ready',
            message: 'Secrets management system is unhealthy',
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      return {
        status: 'ready',
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Readiness check failed',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Simple liveness probe
   */
  @Get('live')
  async getLiveness(): Promise<{ status: string; timestamp: Date }> {
    // Liveness should be simple and not depend on external systems
    return {
      status: 'alive',
      timestamp: new Date(),
    };
  }
}
