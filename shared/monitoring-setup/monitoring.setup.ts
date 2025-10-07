import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  LoggingService,
  MetricsService,
  TracingService,
  MonitoringModule,
  MetricsController,
  LoggingInterceptor,
  PrometheusInterceptor,
} from '@soc-compliance/monitoring';

export interface MonitoringConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  metricsPort?: number;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customLabels?: Record<string, string>;
}

@Global()
@Module({})
export class StandardMonitoringModule {
  static forRoot(config: MonitoringConfig): DynamicModule {
    const providers = [];
    const imports = [];
    const controllers = [];

    // Default configuration
    const finalConfig = {
      enableTracing: true,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info' as const,
      environment: process.env.NODE_ENV || 'development',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
      metricsPort: 9090,
      ...config,
    };

    // Add monitoring module
    imports.push(
      MonitoringModule.forRoot({
        serviceName: finalConfig.serviceName,
        serviceVersion: finalConfig.serviceVersion,
        environment: finalConfig.environment,
        metricsPort: finalConfig.metricsPort,
        customLabels: finalConfig.customLabels,
      })
    );

    // Add metrics controller if metrics enabled
    if (finalConfig.enableMetrics) {
      controllers.push(MetricsController);
    }

    // Add interceptors
    if (finalConfig.enableLogging) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: LoggingInterceptor,
      });
    }

    if (finalConfig.enableMetrics) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: PrometheusInterceptor,
      });
    }

    // Add health check monitoring
    providers.push({
      provide: 'MONITORING_CONFIG',
      useValue: finalConfig,
    });

    return {
      module: StandardMonitoringModule,
      imports,
      providers,
      controllers,
      exports: [
        MonitoringModule,
        'MONITORING_CONFIG',
      ],
    };
  }
}

/**
 * Standard monitoring setup for services
 * This provides a consistent monitoring configuration across all services
 */
export function setupServiceMonitoring(serviceName: string): DynamicModule {
  return StandardMonitoringModule.forRoot({
    serviceName,
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    enableTracing: process.env.ENABLE_TRACING !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enableLogging: process.env.ENABLE_LOGGING !== 'false',
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    customLabels: {
      region: process.env.AWS_REGION || 'us-east-1',
      cluster: process.env.CLUSTER_NAME || 'local',
      namespace: process.env.K8S_NAMESPACE || 'default',
    },
  });
}

/**
 * Monitoring decorator to add to service classes
 */
export function MonitoredService() {
  return function (constructor: Function) {
    // Add monitoring metadata
    Reflect.defineMetadata('monitoring:enabled', true, constructor);
    Reflect.defineMetadata('monitoring:service', constructor.name, constructor);
  };
}

/**
 * Helper to add monitoring to a method
 */
export function MonitorMethod(options?: {
  name?: string;
  skipLogging?: boolean;
  skipMetrics?: boolean;
  skipTracing?: boolean;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName = options?.name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const context = {
        method: methodName,
        args: args.length > 0 ? args : undefined,
      };

      // Log method entry
      if (!options?.skipLogging && this.logger) {
        this.logger.debug(`Entering ${methodName}`, context);
      }

      try {
        const result = await originalMethod.apply(this, args);
        
        // Record success metrics
        if (!options?.skipMetrics && this.metricsService) {
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.recordHistogram(
            `${methodName.toLowerCase().replace(/\./g, '_')}_duration_seconds`,
            duration,
            { status: 'success' }
          );
          this.metricsService.incrementCounter(
            `${methodName.toLowerCase().replace(/\./g, '_')}_total`,
            { status: 'success' }
          );
        }

        // Log method exit
        if (!options?.skipLogging && this.logger) {
          this.logger.debug(`Exiting ${methodName}`, {
            ...context,
            duration: Date.now() - startTime,
          });
        }

        return result;
      } catch (error) {
        // Record error metrics
        if (!options?.skipMetrics && this.metricsService) {
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.recordHistogram(
            `${methodName.toLowerCase().replace(/\./g, '_')}_duration_seconds`,
            duration,
            { status: 'error' }
          );
          this.metricsService.incrementCounter(
            `${methodName.toLowerCase().replace(/\./g, '_')}_total`,
            { status: 'error' }
          );
          this.metricsService.incrementCounter(
            `${methodName.toLowerCase().replace(/\./g, '_')}_errors_total`,
            { 
              error_type: error.constructor.name,
              error_message: error.message?.substring(0, 50), // Truncate for cardinality
            }
          );
        }

        // Log error
        if (!options?.skipLogging && this.logger) {
          this.logger.error(`Error in ${methodName}`, error.stack, {
            ...context,
            error: error.message,
            duration: Date.now() - startTime,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Health check metrics collector
 */
export class HealthMetricsCollector {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly serviceName: string
  ) {
    this.setupHealthMetrics();
  }

  private setupHealthMetrics() {
    // Register health check metrics
    this.metricsService.registerGauge(
      `${this.serviceName}_health_status`,
      'Health status of the service (1 = healthy, 0 = unhealthy)'
    );

    this.metricsService.registerGauge(
      `${this.serviceName}_dependencies_health`,
      'Health status of service dependencies',
      ['dependency']
    );

    this.metricsService.registerHistogram(
      `${this.serviceName}_health_check_duration_seconds`,
      'Duration of health checks in seconds',
      ['check_type']
    );
  }

  recordHealthStatus(isHealthy: boolean) {
    this.metricsService.setGauge(
      `${this.serviceName}_health_status`,
      isHealthy ? 1 : 0
    );
  }

  recordDependencyHealth(dependency: string, isHealthy: boolean) {
    this.metricsService.setGauge(
      `${this.serviceName}_dependencies_health`,
      isHealthy ? 1 : 0,
      { dependency }
    );
  }

  recordHealthCheckDuration(checkType: string, duration: number) {
    this.metricsService.recordHistogram(
      `${this.serviceName}_health_check_duration_seconds`,
      duration,
      { check_type: checkType }
    );
  }
}

/**
 * Business metrics collector for domain-specific metrics
 */
export class BusinessMetricsCollector {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly serviceName: string
  ) {}

  // Auth Service metrics
  recordLogin(success: boolean, method: string) {
    this.metricsService.incrementCounter('auth_login_attempts_total', {
      status: success ? 'success' : 'failure',
      method,
    });
  }

  recordTokenGeneration(tokenType: 'access' | 'refresh') {
    this.metricsService.incrementCounter('auth_tokens_generated_total', {
      token_type: tokenType,
    });
  }

  // Client Service metrics
  recordClientCreation(clientType: string) {
    this.metricsService.incrementCounter('clients_created_total', {
      client_type: clientType,
    });
  }

  recordClientUpdate(updateType: string) {
    this.metricsService.incrementCounter('clients_updated_total', {
      update_type: updateType,
    });
  }

  // Policy Service metrics
  recordPolicyEvaluation(policyType: string, result: 'allow' | 'deny') {
    this.metricsService.incrementCounter('policy_evaluations_total', {
      policy_type: policyType,
      result,
    });
  }

  recordPolicyUpdate(policyId: string, version: number) {
    this.metricsService.incrementCounter('policy_updates_total', {
      policy_id: policyId,
      version: version.toString(),
    });
  }

  // Control Service metrics
  recordControlTest(controlId: string, result: 'pass' | 'fail' | 'partial') {
    this.metricsService.incrementCounter('control_tests_total', {
      control_id: controlId,
      result,
    });
  }

  recordControlCompliance(framework: string, complianceLevel: number) {
    this.metricsService.setGauge('control_compliance_level', complianceLevel, {
      framework,
    });
  }

  // Workflow Service metrics
  recordWorkflowStart(workflowType: string) {
    this.metricsService.incrementCounter('workflows_started_total', {
      workflow_type: workflowType,
    });
  }

  recordWorkflowCompletion(workflowType: string, status: string, duration: number) {
    this.metricsService.incrementCounter('workflows_completed_total', {
      workflow_type: workflowType,
      status,
    });
    this.metricsService.recordHistogram('workflow_duration_seconds', duration, {
      workflow_type: workflowType,
    });
  }

  // Evidence Service metrics
  recordEvidenceCollection(evidenceType: string, source: string) {
    this.metricsService.incrementCounter('evidence_collected_total', {
      evidence_type: evidenceType,
      source,
    });
  }

  recordEvidenceValidation(isValid: boolean, validationType: string) {
    this.metricsService.incrementCounter('evidence_validations_total', {
      status: isValid ? 'valid' : 'invalid',
      validation_type: validationType,
    });
  }

  // Notification Service metrics
  recordNotificationSent(channel: string, success: boolean) {
    this.metricsService.incrementCounter('notifications_sent_total', {
      channel,
      status: success ? 'success' : 'failure',
    });
  }

  recordNotificationDelivery(channel: string, deliveryTime: number) {
    this.metricsService.recordHistogram('notification_delivery_seconds', deliveryTime, {
      channel,
    });
  }

  // Generic business metric
  recordBusinessEvent(eventName: string, labels: Record<string, string> = {}) {
    this.metricsService.incrementCounter(`business_event_${eventName}_total`, labels);
  }

  recordBusinessMetric(metricName: string, value: number, labels: Record<string, string> = {}) {
    this.metricsService.recordHistogram(`business_metric_${metricName}`, value, labels);
  }
}