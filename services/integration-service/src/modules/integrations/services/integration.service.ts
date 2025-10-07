import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { 
  BaseServiceData, 
  OrganizationResponse
} from '@soc-compliance/contracts';
import {
  EventType,
  type IntegrationConnectedEvent,
  type IntegrationDisconnectedEvent,
} from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { CreateIntegrationDto } from '../dto/create-integration.dto';
import type { FilterIntegrationDto } from '../dto/filter-integration.dto';
import type { FilterLogsDto } from '../dto/filter-logs.dto';
import type { UpdateIntegrationDto } from '../dto/update-integration.dto';
import { 
  Integration, 
  type IntegrationStats,
  IntegrationStatus,
  IntegrationType 
} from '../entities/integration.entity';
import { IntegrationLog, type OperationType } from '../entities/integration-log.entity';
import type { ConnectorFactory } from './connector.factory';
import type { HealthCheckService } from './health-check.service';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
  latency?: number;
  details?: any;
}

export interface IntegrationStatistics extends IntegrationStats {
  successRate: number;
  averageResponseTime: number;
  isHealthy: boolean;
  lastHealthCheck?: Date;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
    private readonly connectorFactory: ConnectorFactory,
    private readonly healthCheckService: HealthCheckService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async create(dto: CreateIntegrationDto): Promise<Integration> {
    // Check for duplicate name
    const existing = await this.integrationRepository.findOne({
      where: {
        organizationId: dto.organizationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(`Integration with name "${dto.name}" already exists`);
    }

    // Create integration with pending status
    const integration = this.integrationRepository.create({
      ...dto,
      status: IntegrationStatus.PENDING,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
      },
    });

    let savedIntegration = await this.integrationRepository.save(integration);

    // Test connection
    try {
      const connector = await this.connectorFactory.createConnector(savedIntegration);
      const testResult = await connector.testConnection();

      if (testResult.success) {
        savedIntegration.status = IntegrationStatus.ACTIVE;
        savedIntegration.isHealthy = true;
        savedIntegration.healthMessage = testResult.message;
      } else {
        savedIntegration.status = IntegrationStatus.ERROR;
        savedIntegration.isHealthy = false;
        savedIntegration.healthMessage = testResult.message;
      }

      savedIntegration = await this.integrationRepository.save(savedIntegration);

      // Log the test result
      await this.logOperation(
        savedIntegration.id,
        'TEST_CONNECTION',
        testResult.success,
        testResult.message,
        null,
        { success: testResult.success, details: testResult.details },
        testResult.latency,
      );
    } catch (error) {
      savedIntegration.status = IntegrationStatus.ERROR;
      savedIntegration.isHealthy = false;
      savedIntegration.healthMessage = 'Connection test failed';
      savedIntegration = await this.integrationRepository.save(savedIntegration);

      await this.logOperation(
        savedIntegration.id,
        'TEST_CONNECTION',
        false,
        'Connection test failed',
        null,
        null,
        undefined,
        error.message,
      );
    }

    // Emit standardized integration connected event
    const integrationConnectedEvent: IntegrationConnectedEvent = {
      id: uuidv4(),
      type: EventType.INTEGRATION_CONNECTED,
      timestamp: new Date(),
      version: '1.0',
      source: 'integration-service',
      userId: dto.createdBy,
      organizationId: dto.organizationId!,
      payload: {
        integrationId: savedIntegration.id,
        integrationType: savedIntegration.integrationType,
        organizationId: dto.organizationId!,
        connectedBy: dto.createdBy || 'system',
        configuration: savedIntegration.configuration ? Object.keys(savedIntegration.configuration) : [],
      },
    };
    
    await this.eventEmitter.emit('integration.connected', integrationConnectedEvent);
    this.logger.log(`Emitted integration.connected event for integration ${savedIntegration.id}`);

    return savedIntegration;
  }

  async findAll(organizationId: string, filters?: FilterIntegrationDto): Promise<Integration[]> {
    const queryBuilder = this.integrationRepository.createQueryBuilder('integration');
    
    queryBuilder.where('integration.organizationId = :organizationId', { organizationId });

    if (filters?.status) {
      queryBuilder.andWhere('integration.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      queryBuilder.andWhere('integration.integrationType = :type', { type: filters.type });
    }

    if (filters?.isHealthy !== undefined) {
      queryBuilder.andWhere('integration.isHealthy = :isHealthy', { isHealthy: filters.isHealthy });
    }

    if (filters?.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('integration.tags @> :tags', { tags: filters.tags });
    }

    queryBuilder.orderBy('integration.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.integrationRepository.findOne({
      where: { id, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  async update(id: string, organizationId: string, dto: UpdateIntegrationDto): Promise<Integration> {
    const integration = await this.findOne(id, organizationId);

    // Prevent status changes for integrations in ERROR state
    if (integration.status === IntegrationStatus.ERROR && dto.status) {
      throw new BadRequestException(
        'Cannot change status of integration in ERROR state. Please test connection first.',
      );
    }

    Object.assign(integration, dto);
    return this.integrationRepository.save(integration);
  }

  async delete(id: string, organizationId: string, userId?: string): Promise<void> {
    const integration = await this.findOne(id, organizationId);
    
    await this.integrationRepository.softDelete(id);

    // Emit standardized integration disconnected event
    const integrationDisconnectedEvent: IntegrationDisconnectedEvent = {
      id: uuidv4(),
      type: EventType.INTEGRATION_DISCONNECTED,
      timestamp: new Date(),
      version: '1.0',
      source: 'integration-service',
      userId,
      organizationId,
      payload: {
        integrationId: id,
        integrationType: integration.integrationType,
        organizationId,
        disconnectedBy: userId || 'system',
        reason: 'Manual deletion',
      },
    };
    
    await this.eventEmitter.emit('integration.disconnected', integrationDisconnectedEvent);
    this.logger.log(`Emitted integration.disconnected event for integration ${id}`);
  }

  async testConnection(id: string, organizationId: string): Promise<ConnectionTestResult> {
    const integration = await this.findOne(id, organizationId);

    try {
      const connector = await this.connectorFactory.createConnector(integration);
      const startTime = Date.now();
      const result = await connector.testConnection();
      const latency = Date.now() - startTime;

      // Update integration health status
      integration.isHealthy = result.success;
      integration.healthMessage = result.message;
      if (result.success) {
        integration.stats.lastSuccessAt = new Date();
      } else {
        integration.stats.lastFailureAt = new Date();
      }
      integration.stats.lastHealthCheckAt = new Date();

      await this.integrationRepository.save(integration);

      // Log the test
      await this.logOperation(
        id,
        'TEST_CONNECTION',
        result.success,
        result.message,
        null,
        { ...result, latency },
        latency,
      );

      return { ...result, latency };
    } catch (error) {
      const errorResult = {
        success: false,
        message: 'Connection test failed',
        error: error.message,
      };

      // Update integration health status
      integration.isHealthy = false;
      integration.healthMessage = errorResult.message;
      integration.stats.lastFailureAt = new Date();
      integration.stats.lastHealthCheckAt = new Date();
      
      await this.integrationRepository.save(integration);

      // Log the error
      await this.logOperation(
        id,
        'TEST_CONNECTION',
        false,
        errorResult.message,
        null,
        null,
        undefined,
        error.message,
      );

      return errorResult;
    }
  }

  async activate(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.findOne(id, organizationId);

    if (integration.status === IntegrationStatus.ACTIVE) {
      return integration;
    }

    // Test connection before activating
    const testResult = await this.testConnection(id, organizationId);
    
    if (!testResult.success) {
      throw new BadRequestException(`Cannot activate integration: ${testResult.message}`);
    }

    integration.status = IntegrationStatus.ACTIVE;
    integration.isHealthy = true;
    
    const activated = await this.integrationRepository.save(integration);

    await this.eventEmitter.emit('integration.activated', {
      integrationId: id,
      organizationId,
    });

    return activated;
  }

  async deactivate(id: string, organizationId: string): Promise<Integration> {
    const integration = await this.findOne(id, organizationId);

    integration.status = IntegrationStatus.INACTIVE;
    
    const deactivated = await this.integrationRepository.save(integration);

    await this.eventEmitter.emit('integration.deactivated', {
      integrationId: id,
      organizationId,
    });

    return deactivated;
  }

  async getStats(id: string, organizationId: string): Promise<IntegrationStatistics> {
    const integration = await this.findOne(id, organizationId);

    // Get recent logs for statistics
    const recentLogs = await this.logRepository.find({
      where: { integrationId: id },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    const totalRequests = recentLogs.length;
    const successfulRequests = recentLogs.filter(log => log.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Calculate average response time from successful requests
    const successfulLogsWithDuration = recentLogs.filter(log => log.success && log.duration !== undefined);
    const averageResponseTime = successfulLogsWithDuration.length > 0
      ? successfulLogsWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0) / successfulLogsWithDuration.length
      : 0;

    // Get health check status
    const healthHistory = await this.healthCheckService.getHealthHistory(id);
    const lastHealthCheck = healthHistory.length > 0 ? healthHistory[0].timestamp : undefined;

    return {
      ...integration.stats,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      isHealthy: integration.isHealthy,
      lastHealthCheck,
    };
  }

  async getLogs(id: string, organizationId: string, filters: FilterLogsDto): Promise<IntegrationLog[]> {
    await this.findOne(id, organizationId); // Verify access

    const queryBuilder = this.logRepository.createQueryBuilder('log');
    
    queryBuilder.where('log.integrationId = :integrationId', { integrationId: id });

    if (filters.startDate) {
      queryBuilder.andWhere('log.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('log.timestamp <= :endDate', { endDate: filters.endDate });
    }

    if (filters.logLevel) {
      queryBuilder.andWhere('log.logLevel = :logLevel', { logLevel: filters.logLevel });
    }

    if (filters.operationType) {
      queryBuilder.andWhere('log.operationType = :operationType', { 
        operationType: filters.operationType 
      });
    }

    if (filters.success !== undefined) {
      queryBuilder.andWhere('log.success = :success', { success: filters.success });
    }

    queryBuilder.orderBy('log.timestamp', 'DESC');
    queryBuilder.limit(filters.limit || 100);

    return queryBuilder.getMany();
  }

  private async logOperation(
    integrationId: string,
    operationType: OperationType,
    success: boolean,
    message: string,
    requestData?: any,
    responseData?: any,
    duration?: number,
    errorDetails?: string,
  ): Promise<IntegrationLog> {
    const log = this.logRepository.create({
      integrationId,
      operationType,
      success,
      message,
      requestData,
      responseData,
      duration,
      errorDetails,
      logLevel: success ? 'INFO' : 'ERROR',
    });

    return this.logRepository.save(log);
  }

  /**
   * Validate integration with other internal services
   */
  async validateWithInternalServices(
    integrationId: string,
    organizationId: string
  ): Promise<{ valid: boolean; issues: string[]; recommendations: string[] }> {
    const integration = await this.findOne(integrationId, organizationId);
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Validate organization exists in client-service
      try {
        const orgResponse = await this.serviceDiscovery.callService<{ success: boolean; data: any }>(
          'client-service',
          'GET',
          `/api/v1/organizations/${organizationId}`
        );
        
        if (!orgResponse.success) {
          issues.push('Organization not found in client service');
        } else {
          this.logger.log(`Organization ${organizationId} validated successfully`);
        }
      } catch (error) {
        this.logger.warn(`Could not validate organization with client-service: ${error.message}`);
        issues.push('Unable to validate organization status');
      }
      
      // Validate compliance requirements with policy-service for security integrations
      if (integration.integrationType === IntegrationType.SECURITY) {
        try {
          const policyResponse = await this.serviceDiscovery.callService<{ success: boolean; data: any }>(
            'policy-service',
            'GET',
            `/api/v1/policies/compliance-check/${organizationId}`
          );
          
          if (policyResponse.success) {
            recommendations.push('Consider enabling automatic policy sync for security integrations');
          }
        } catch (error) {
          this.logger.warn(`Could not validate policies: ${error.message}`);
          recommendations.push('Enable policy validation for security integrations');
        }
      }

      // Validate security settings with auth-service
      try {
        const securityValidation = await this.serviceDiscovery.callService<{ success: boolean; data: any }>(
          'auth-service',
          'POST',
          '/api/v1/validate-integration',
          {
            integrationId,
            organizationId,
            integrationType: integration.integrationType,
            authType: integration.authType
          }
        );
        
        if (!securityValidation.success) {
          issues.push('Integration does not meet security requirements');
        }
      } catch (error) {
        this.logger.warn(`Could not validate security settings: ${error.message}`);
      }
      
      // Check configuration for security settings
      if (!integration.configuration?.customConfig?.encryptionEnabled) {
        issues.push('Integration does not have encryption enabled in configuration');
        recommendations.push('Enable encryption for sensitive data transfers');
      }

      // Validate with audit-service for compliance tracking
      if (integration.integrationType === IntegrationType.COMPLIANCE || 
          integration.integrationType === IntegrationType.SECURITY) {
        try {
          await this.serviceDiscovery.callService(
            'audit-service',
            'POST',
            '/api/v1/events',
            {
              eventType: 'integration.validation',
              organizationId,
              integrationId,
              details: {
                type: integration.integrationType,
                status: integration.status
              }
            }
          );
        } catch (error) {
          this.logger.warn(`Could not log to audit service: ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`Error validating integration with internal services:`, error);
      issues.push(`Validation error: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Get integration health status from multiple services
   */
  async getIntegrationHealthFromServices(
    integrationId: string,
    organizationId: string
  ): Promise<{ overallHealth: boolean; serviceStatuses: Record<string, any> }> {
    const integration = await this.findOne(integrationId, organizationId);
    const serviceStatuses: Record<string, any> = {};
    let overallHealth = true;

    try {
      // Check if organization is active in client-service
      try {
        const orgResponse = await this.serviceDiscovery.callService<any>(
          'client-service',
          'GET',
          `/api/v1/organizations/${organizationId}/status`
        );
        serviceStatuses['client-service'] = {
          healthy: orgResponse.success,
          status: orgResponse.data?.status || 'unknown'
        };
        if (!orgResponse.success) overallHealth = false;
      } catch (error) {
        serviceStatuses['client-service'] = { healthy: false, error: error.message };
        overallHealth = false;
      }

      // Check control status if this is a control-related integration
      if (integration.integrationType === IntegrationType.SECURITY ||
          integration.integrationType === IntegrationType.COMPLIANCE) {
        try {
          const controlResponse = await this.serviceDiscovery.callService<any>(
            'control-service',
            'GET',
            `/api/v1/controls/health/${organizationId}`
          );
          serviceStatuses['control-service'] = {
            healthy: controlResponse.success,
            controlsCount: controlResponse.data?.totalControls || 0
          };
        } catch (error) {
          serviceStatuses['control-service'] = { healthy: false, error: error.message };
        }
      }

      // Check evidence service for evidence collection integrations
      if (integration.integrationType === IntegrationType.SECURITY) {
        try {
          const evidenceResponse = await this.serviceDiscovery.callService<any>(
            'evidence-service',
            'GET',
            `/api/v1/evidence/health/${organizationId}`
          );
          serviceStatuses['evidence-service'] = {
            healthy: evidenceResponse.success,
            evidenceCount: evidenceResponse.data?.totalEvidence || 0
          };
        } catch (error) {
          serviceStatuses['evidence-service'] = { healthy: false, error: error.message };
        }
      }

    } catch (error) {
      this.logger.error(`Error checking service health:`, error);
      overallHealth = false;
    }

    return { overallHealth, serviceStatuses };
  }
}