import {
  type DynamicModule,
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { MetricsController } from './controllers/metrics.controller';
import { SecretsHealthController } from './controllers/secrets-health.controller';
import type { MonitoringConfig } from './interfaces';
import { LoggingService } from './logging';
import { MetricsService } from './metrics';
import { MonitoringMiddleware } from './middleware';
import { SecretsHealthCheckService } from './secrets-health-check.service';
import { SecretsMonitoringService } from './secrets-monitoring.service';
import { TracingService } from './tracing';

@Global()
@Module({})
export class MonitoringModule implements NestModule {
  static forRoot(config: MonitoringConfig): DynamicModule {
    // Validate and sanitize config to prevent undefined values
    const sanitizedConfig = MonitoringModule.sanitizeConfig(config);

    const providers = [
      {
        provide: 'MONITORING_CONFIG',
        useValue: sanitizedConfig,
      },
      {
        provide: MetricsService,
        useFactory: () => {
          const metricsService = new MetricsService(sanitizedConfig.metrics);
          // Register SOC compliance metrics
          metricsService.registerComplianceMetrics();
          // Register secrets management metrics
          metricsService.registerSecretsMetrics();
          return metricsService;
        },
      },
      {
        provide: TracingService,
        useFactory: () => new TracingService(sanitizedConfig.tracing),
      },
      {
        provide: LoggingService,
        useFactory: () => new LoggingService(sanitizedConfig.logging),
      },
      SecretsMonitoringService,
      SecretsHealthCheckService,
    ];

    return {
      module: MonitoringModule,
      providers,
      controllers: [MetricsController, SecretsHealthController],
      exports: [
        MetricsService,
        TracingService,
        LoggingService,
        SecretsMonitoringService,
        SecretsHealthCheckService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MonitoringMiddleware).forRoutes('*');
  }

  private static sanitizeConfig(config: MonitoringConfig): MonitoringConfig {
    return {
      metrics: {
        ...config.metrics,
        defaultLabels: config.metrics.defaultLabels || {},
      },
      tracing: {
        ...config.tracing,
        headers: config.tracing.headers || {},
      },
      logging: {
        ...config.logging,
        // Ensure optional properties are either valid objects or null
        elasticsearch: config.logging.elasticsearch || null,
        file: config.logging.file || null,
      },
    };
  }
}
