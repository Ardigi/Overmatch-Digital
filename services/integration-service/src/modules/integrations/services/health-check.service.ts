import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration, IntegrationStatus } from '../entities/integration.entity';
import type { ConnectorFactory } from './connector.factory';

export interface HealthCheckResult {
  integrationId: string;
  timestamp: Date;
  isHealthy: boolean;
  message?: string;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly connectorFactory: ConnectorFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performScheduledHealthChecks(): Promise<void> {
    const activeIntegrations = await this.integrationRepository.find({
      where: { status: IntegrationStatus.ACTIVE },
    });

    for (const integration of activeIntegrations) {
      if (this.shouldCheckHealth(integration)) {
        await this.checkHealth(integration);
      }
    }
  }

  async checkHealth(integration: Integration): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const connector = await this.connectorFactory.createConnector(integration);
      const testResult = await connector.testConnection();

      result = {
        integrationId: integration.id,
        timestamp: new Date(),
        isHealthy: testResult.success,
        message: testResult.message,
        responseTime: Date.now() - startTime,
      };

      // Update integration health status
      integration.isHealthy = testResult.success;
      integration.healthMessage = testResult.message;
      integration.stats.lastHealthCheckAt = new Date();
      
      if (testResult.success) {
        integration.stats.lastSuccessAt = new Date();
      } else {
        integration.stats.lastFailureAt = new Date();
      }

      await this.integrationRepository.save(integration);

      // Emit event for health status change
      if (integration.isHealthy !== result.isHealthy) {
        await this.eventEmitter.emit('integration.health.changed', {
          integrationId: integration.id,
          organizationId: integration.organizationId,
          isHealthy: result.isHealthy,
          message: result.message,
        });
      }
    } catch (error) {
      result = {
        integrationId: integration.id,
        timestamp: new Date(),
        isHealthy: false,
        message: 'Health check failed',
        error: error.message,
        responseTime: Date.now() - startTime,
      };

      integration.isHealthy = false;
      integration.healthMessage = result.message;
      integration.stats.lastHealthCheckAt = new Date();
      integration.stats.lastFailureAt = new Date();

      await this.integrationRepository.save(integration);

      this.logger.error(`Health check failed for integration ${integration.id}`, error);
    }

    // Store in history
    this.addToHistory(integration.id, result);

    return result;
  }

  async getHealthHistory(integrationId: string): Promise<HealthCheckResult[]> {
    return this.healthHistory.get(integrationId) || [];
  }

  async scheduleHealthCheck(integration: Integration): Promise<void> {
    // In a real implementation, this would schedule a job
    // For now, we'll just perform an immediate check
    await this.checkHealth(integration);
  }

  async updateHealthStatus(
    integrationId: string, 
    isHealthy: boolean, 
    message?: string
  ): Promise<void> {
    const integration = await this.integrationRepository.findOne({
      where: { id: integrationId },
    });

    if (!integration) {
      return;
    }

    integration.isHealthy = isHealthy;
    integration.healthMessage = message || (isHealthy ? 'Healthy' : 'Unhealthy');
    integration.stats.lastHealthCheckAt = new Date();

    await this.integrationRepository.save(integration);

    const result: HealthCheckResult = {
      integrationId,
      timestamp: new Date(),
      isHealthy,
      message,
    };

    this.addToHistory(integrationId, result);
  }

  private shouldCheckHealth(integration: Integration): boolean {
    if (!integration.healthCheck) {
      return false;
    }

    const lastCheck = integration.stats.lastHealthCheckAt;
    if (!lastCheck) {
      return true;
    }

    const intervalMs = (integration.healthCheck.interval || 300) * 1000;
    const timeSinceLastCheck = Date.now() - lastCheck.getTime();

    return timeSinceLastCheck >= intervalMs;
  }

  private addToHistory(integrationId: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(integrationId)) {
      this.healthHistory.set(integrationId, []);
    }

    const history = this.healthHistory.get(integrationId)!;
    history.unshift(result);

    // Keep only last 100 results
    if (history.length > 100) {
      history.splice(100);
    }
  }
}