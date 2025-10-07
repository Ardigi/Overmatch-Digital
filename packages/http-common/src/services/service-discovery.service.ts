import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckResponse, ServiceResponse } from '../interfaces/http-response.interface';
import type {
  HttpRequestConfig,
  ServiceConfig,
  ServiceDiscoveryConfig,
} from '../interfaces/service-config.interface';
import { HttpClientService } from './http-client.service';

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private serviceRegistry: Map<string, ServiceConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService
  ) {}

  onModuleInit() {
    this.initializeServices();
    this.registerCurrentService();
    this.startHealthChecks();
  }

  private initializeServices() {
    // Determine if we're in Docker environment
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
    const defaultTimeout = this.configService.get<number>('SERVICE_TIMEOUT') || 30000;
    const defaultRetries = this.configService.get<number>('SERVICE_RETRIES') || 3;

    // Default service configuration
    const defaultConfig: ServiceDiscoveryConfig = {
      services: {
        'auth-service': {
          name: 'auth-service',
          url:
            this.configService.get('AUTH_SERVICE_URL') ||
            (isDocker ? 'http://auth-service:3001' : 'http://localhost:3001'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'client-service': {
          name: 'client-service',
          url:
            this.configService.get('CLIENT_SERVICE_URL') ||
            (isDocker ? 'http://client-service:3002' : 'http://localhost:3002'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'policy-service': {
          name: 'policy-service',
          url:
            this.configService.get('POLICY_SERVICE_URL') ||
            (isDocker ? 'http://policy-service:3003' : 'http://localhost:3003'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'control-service': {
          name: 'control-service',
          url:
            this.configService.get('CONTROL_SERVICE_URL') ||
            (isDocker ? 'http://control-service:3004' : 'http://localhost:3004'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'evidence-service': {
          name: 'evidence-service',
          url:
            this.configService.get('EVIDENCE_SERVICE_URL') ||
            (isDocker ? 'http://evidence-service:3005' : 'http://localhost:3005'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'workflow-service': {
          name: 'workflow-service',
          url:
            this.configService.get('WORKFLOW_SERVICE_URL') ||
            (isDocker ? 'http://workflow-service:3006' : 'http://localhost:3006'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'reporting-service': {
          name: 'reporting-service',
          url:
            this.configService.get('REPORTING_SERVICE_URL') ||
            (isDocker ? 'http://reporting-service:3007' : 'http://localhost:3007'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'audit-service': {
          name: 'audit-service',
          url:
            this.configService.get('AUDIT_SERVICE_URL') ||
            (isDocker ? 'http://audit-service:3008' : 'http://localhost:3008'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'integration-service': {
          name: 'integration-service',
          url:
            this.configService.get('INTEGRATION_SERVICE_URL') ||
            (isDocker ? 'http://integration-service:3009' : 'http://localhost:3009'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'notification-service': {
          name: 'notification-service',
          url:
            this.configService.get('NOTIFICATION_SERVICE_URL') ||
            (isDocker ? 'http://notification-service:3010' : 'http://localhost:3010'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
        'ai-service': {
          name: 'ai-service',
          url:
            this.configService.get('AI_SERVICE_URL') ||
            (isDocker ? 'http://ai-service:3011' : 'http://localhost:3011'),
          timeout: defaultTimeout,
          retries: defaultRetries,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        },
      },
    };

    // Register all services
    Object.entries(defaultConfig.services).forEach(([key, config]) => {
      this.serviceRegistry.set(key, config);
      this.logger.log(`Registered service: ${key} at ${config.url}`);
    });
  }

  /**
   * Register the current service in the registry
   */
  private registerCurrentService() {
    const currentServiceName = process.env.SERVICE_NAME;
    const currentServicePort = process.env.PORT || process.env.SERVICE_PORT;

    if (currentServiceName && currentServicePort) {
      const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
      const currentServiceUrl = isDocker
        ? `http://${currentServiceName}:${currentServicePort}`
        : `http://localhost:${currentServicePort}`;

      // Update the service registry with the current service's actual URL
      if (this.serviceRegistry.has(currentServiceName)) {
        const existing = this.serviceRegistry.get(currentServiceName)!;
        existing.url = currentServiceUrl;
        this.logger.log(
          `Updated current service registration: ${currentServiceName} at ${currentServiceUrl}`
        );
      } else {
        // Register new service if not in default config
        this.serviceRegistry.set(currentServiceName, {
          name: currentServiceName,
          url: currentServiceUrl,
          timeout: 30000,
          retries: 3,
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
            resetTimeout: 30000,
          },
        });
        this.logger.log(
          `Registered current service: ${currentServiceName} at ${currentServiceUrl}`
        );
      }
    }
  }

  getService(serviceName: string): ServiceConfig | undefined {
    return this.serviceRegistry.get(serviceName);
  }

  /**
   * Register or update a service in the registry
   */
  registerService(serviceName: string, config: ServiceConfig): void {
    this.serviceRegistry.set(serviceName, config);
    this.logger.log(`Service registered/updated: ${serviceName} at ${config.url}`);
  }

  /**
   * Unregister a service from the registry
   */
  unregisterService(serviceName: string): boolean {
    const removed = this.serviceRegistry.delete(serviceName);
    if (removed) {
      this.logger.log(`Service unregistered: ${serviceName}`);
    }
    return removed;
  }

  /**
   * Check if a service is registered
   */
  isServiceRegistered(serviceName: string): boolean {
    return this.serviceRegistry.has(serviceName);
  }

  getAllServices(): Map<string, ServiceConfig> {
    return new Map(this.serviceRegistry);
  }

  async callService<T>(
    serviceName: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<ServiceResponse<T>> {
    const serviceConfig = this.getService(serviceName);

    if (!serviceConfig) {
      this.logger.error(
        `Service ${serviceName} not found in registry. Available services: ${Array.from(this.serviceRegistry.keys()).join(', ')}`
      );
      return {
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service ${serviceName} not found in registry`,
          timestamp: new Date(),
        },
      };
    }

    const url = `${serviceConfig.url}${path}`;
    this.logger.debug(`Calling ${serviceName}: ${method} ${url}`);

    try {
      let response: ServiceResponse<T>;

      switch (method) {
        case 'GET':
          response = await this.httpClient.get<T>(url, config, serviceConfig);
          break;
        case 'POST':
          response = await this.httpClient.post<T>(url, data, config, serviceConfig);
          break;
        case 'PUT':
          response = await this.httpClient.put<T>(url, data, config, serviceConfig);
          break;
        case 'PATCH':
          response = await this.httpClient.patch<T>(url, data, config, serviceConfig);
          break;
        case 'DELETE':
          response = await this.httpClient.delete<T>(url, config, serviceConfig);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      if (response.success) {
        this.logger.debug(`Successfully called ${serviceName}: ${method} ${url}`);
      } else {
        this.logger.warn(`Service call failed ${serviceName}: ${method} ${url}`, response.error);
      }

      return response;
    } catch (error: any) {
      this.logger.error(`Service call error ${serviceName}: ${method} ${url}`, error);
      return {
        success: false,
        error: {
          code: 'SERVICE_CALL_ERROR',
          message: `Failed to call ${serviceName}: ${error.message}`,
          timestamp: new Date(),
        },
      };
    }
  }

  private startHealthChecks() {
    const interval = this.configService.get<number>('SERVICE_HEALTH_CHECK_INTERVAL') || 60000;

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllServices();
    }, interval);

    // Initial health check
    this.checkAllServices();
  }

  async checkAllServices(): Promise<Map<string, HealthCheckResponse>> {
    const results = new Map<string, HealthCheckResponse>();

    for (const [name, config] of this.serviceRegistry) {
      const health = await this.checkServiceHealth(name);
      results.set(name, health);
    }

    return results;
  }

  async checkServiceHealth(serviceName: string): Promise<HealthCheckResponse> {
    const serviceConfig = this.getService(serviceName);

    if (!serviceConfig) {
      return {
        status: 'unhealthy',
        service: serviceName,
        timestamp: new Date(),
        details: {
          database: { status: 'down', message: 'Service not found in registry' },
        },
      };
    }

    // Try different health check endpoints in order of preference
    const healthEndpoints = ['/api/v1/health', '/health', '/health/check', '/api/health'];

    for (const endpoint of healthEndpoints) {
      try {
        const response = await this.httpClient.get<HealthCheckResponse>(
          `${serviceConfig.url}${endpoint}`,
          { timeout: 5000 },
          { ...serviceConfig, circuitBreaker: undefined } // Skip circuit breaker for health checks
        );

        if (response.success && response.data) {
          this.logger.debug(`Health check passed for ${serviceName} via ${endpoint}`);
          return response.data;
        }
      } catch (error: any) {
        // Continue to next endpoint
        this.logger.debug(
          `Health check failed for ${serviceName} via ${endpoint}: ${error.message}`
        );
      }
    }

    // If dedicated health endpoints fail, try a basic connectivity check
    try {
      const response = await this.httpClient.get(
        serviceConfig.url,
        { timeout: 3000 },
        { ...serviceConfig, circuitBreaker: undefined }
      );

      // If we get any response (even 404), the service is at least running
      if (
        response.success ||
        (response.error && ['404', '405', '401'].includes(response.error.code))
      ) {
        this.logger.debug(`Basic connectivity check passed for ${serviceName}`);
        return {
          status: 'healthy',
          service: serviceName,
          timestamp: new Date(),
          details: {
            connectivity: { status: 'up', message: 'Service is responding' },
            note: 'Health endpoint not available, using basic connectivity check',
          },
        };
      }
    } catch (error: any) {
      this.logger.debug(`Basic connectivity check failed for ${serviceName}: ${error.message}`);
    }

    // All checks failed
    this.logger.warn(`All health checks failed for ${serviceName}`);
    return {
      status: 'unhealthy',
      service: serviceName,
      timestamp: new Date(),
      details: {
        connectivity: { status: 'down', message: 'Service is not responding' },
        healthEndpoints: healthEndpoints.join(', '),
      },
    };
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalServices: number;
    registeredServices: string[];
    healthyServices: number;
    unhealthyServices: number;
  } {
    const registeredServices = Array.from(this.serviceRegistry.keys());
    return {
      totalServices: registeredServices.length,
      registeredServices,
      healthyServices: 0, // Would need to track from health checks
      unhealthyServices: 0,
    };
  }

  /**
   * Test connectivity to all services
   */
  async testAllServiceConnectivity(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [serviceName] of this.serviceRegistry) {
      try {
        const health = await this.checkServiceHealth(serviceName);
        results[serviceName] = health.status === 'healthy';
      } catch (error) {
        results[serviceName] = false;
      }
    }

    return results;
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.log('ServiceDiscoveryService destroyed');
  }
}
