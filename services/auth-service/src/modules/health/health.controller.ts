import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import type { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import type { SecretsHealthIndicator } from './secrets-health.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private secretsHealthIndicator: SecretsHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.secretsHealthIndicator.isHealthy('secrets')]);
  }

  @Get('secrets')
  @HealthCheck()
  checkSecrets(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.secretsHealthIndicator.isHealthy('secrets'),
      () => this.secretsHealthIndicator.testCriticalSecrets('critical-secrets'),
    ]);
  }

  @Get('simple')
  simple() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
