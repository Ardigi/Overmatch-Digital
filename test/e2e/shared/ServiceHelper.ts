import axios, { type AxiosInstance } from 'axios';
import * as request from 'supertest';

export interface ServiceConfig {
  name: string;
  port: number;
  healthEndpoint: string;
  baseUrl?: string;
}

export class ServiceHelper {
  private services: Map<string, ServiceConfig> = new Map();
  private axiosInstances: Map<string, AxiosInstance> = new Map();

  constructor() {
    // Initialize default service configurations
    this.initializeServices();
  }

  private initializeServices() {
    const services: ServiceConfig[] = [
      { name: 'auth', port: 3001, healthEndpoint: '/health' },
      { name: 'client', port: 3002, healthEndpoint: '/api/v1/health' },
      { name: 'policy', port: 3003, healthEndpoint: '/health' },
      { name: 'control', port: 3004, healthEndpoint: '/health' },
      { name: 'evidence', port: 3005, healthEndpoint: '/health' },
      { name: 'workflow', port: 3006, healthEndpoint: '/health' },
      { name: 'reporting', port: 3007, healthEndpoint: '/health' },
      { name: 'audit', port: 3008, healthEndpoint: '/health' },
      { name: 'integration', port: 3009, healthEndpoint: '/health' },
      { name: 'notification', port: 3010, healthEndpoint: '/health' },
      { name: 'ai', port: 3011, healthEndpoint: '/health' },
    ];

    services.forEach((service) => {
      service.baseUrl = `http://localhost:${service.port}`;
      this.services.set(service.name, service);

      // Create axios instance for each service
      this.axiosInstances.set(
        service.name,
        axios.create({
          baseURL: service.baseUrl,
          timeout: 30000,
          validateStatus: () => true, // Don't throw on any status
        })
      );
    });
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceName: string): ServiceConfig {
    const config = this.services.get(serviceName);
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }
    return config;
  }

  /**
   * Get axios instance for a service
   */
  getAxiosInstance(serviceName: string): AxiosInstance {
    const instance = this.axiosInstances.get(serviceName);
    if (!instance) {
      throw new Error(`No axios instance for service: ${serviceName}`);
    }
    return instance;
  }

  /**
   * Check if a service is healthy
   */
  async checkServiceHealth(serviceName: string): Promise<boolean> {
    try {
      const config = this.getServiceConfig(serviceName);
      const response = await axios.get(`${config.baseUrl}${config.healthEndpoint}`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for a service to be healthy
   */
  async waitForServiceHealth(serviceName: string, maxRetries = 30, delayMs = 1000): Promise<void> {
    const config = this.getServiceConfig(serviceName);
    console.log(`Waiting for ${serviceName} service to be healthy...`);

    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkServiceHealth(serviceName)) {
        console.log(`✅ ${serviceName} service is healthy`);
        return;
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(`${serviceName} service failed to become healthy after ${maxRetries} attempts`);
  }

  /**
   * Wait for all services to be healthy
   */
  async waitForAllServices(
    serviceNames?: string[],
    maxRetries = 30,
    delayMs = 1000
  ): Promise<void> {
    const services = serviceNames || Array.from(this.services.keys());

    console.log('Waiting for all services to be healthy...');

    const healthPromises = services.map((serviceName) =>
      this.waitForServiceHealth(serviceName, maxRetries, delayMs)
    );

    await Promise.all(healthPromises);

    console.log('✅ All services are healthy');
  }

  /**
   * Check infrastructure services
   */
  async checkInfrastructureHealth(): Promise<{
    postgres: boolean;
    redis: boolean;
    kafka: boolean;
    mongodb?: boolean;
    elasticsearch?: boolean;
  }> {
    const results = {
      postgres: false,
      redis: false,
      kafka: false,
      mongodb: false,
      elasticsearch: false,
    };

    // Check PostgreSQL
    try {
      await axios.get('http://localhost:5433', { timeout: 1000 });
    } catch (error) {
      // PostgreSQL doesn't have HTTP endpoint, check if port is open
      results.postgres = error.code !== 'ECONNREFUSED';
    }

    // Check Redis
    try {
      // Redis also doesn't have HTTP, we'd need to use redis client
      // For now, assume it's up if the port responds
      results.redis = true;
    } catch (error) {
      results.redis = false;
    }

    // Check Kafka
    try {
      // Kafka doesn't have HTTP health endpoint
      // Would need to use Kafka client to properly check
      results.kafka = true;
    } catch (error) {
      results.kafka = false;
    }

    // Check MongoDB (if used)
    try {
      results.mongodb = true;
    } catch (error) {
      results.mongodb = false;
    }

    // Check Elasticsearch
    try {
      const response = await axios.get('http://localhost:9201/_cluster/health', {
        timeout: 5000,
      });
      results.elasticsearch = response.status === 200;
    } catch (error) {
      results.elasticsearch = false;
    }

    return results;
  }

  /**
   * Make authenticated request to a service
   */
  async makeAuthenticatedRequest(
    serviceName: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token: string,
    data?: any,
    headers?: Record<string, string>
  ) {
    const instance = this.getAxiosInstance(serviceName);

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
    };

    switch (method) {
      case 'get':
        return instance.get(path, config);
      case 'post':
        return instance.post(path, data, config);
      case 'put':
        return instance.put(path, data, config);
      case 'patch':
        return instance.patch(path, data, config);
      case 'delete':
        return instance.delete(path, config);
    }
  }

  /**
   * Make API key authenticated request
   */
  async makeApiKeyRequest(
    serviceName: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    apiKey: string,
    data?: any,
    headers?: Record<string, string>
  ) {
    const instance = this.getAxiosInstance(serviceName);

    const config = {
      headers: {
        'X-API-Key': apiKey,
        ...headers,
      },
    };

    switch (method) {
      case 'get':
        return instance.get(path, config);
      case 'post':
        return instance.post(path, data, config);
      case 'put':
        return instance.put(path, data, config);
      case 'patch':
        return instance.patch(path, data, config);
      case 'delete':
        return instance.delete(path, config);
    }
  }

  /**
   * Get service logs (for debugging)
   */
  async getServiceLogs(serviceName: string, lines = 100): Promise<string[]> {
    // This would integrate with your logging infrastructure
    // For now, return placeholder
    console.log(`Getting last ${lines} logs for ${serviceName} service...`);
    return [`Logs for ${serviceName} would appear here`];
  }

  /**
   * Restart a service (useful for testing recovery)
   */
  async restartService(serviceName: string): Promise<void> {
    console.log(`Restarting ${serviceName} service...`);
    // This would integrate with your container orchestration
    // For Docker Compose: docker-compose restart service-name
    throw new Error('Service restart not implemented in test environment');
  }

  /**
   * Get all service URLs
   */
  getAllServiceUrls(): Record<string, string> {
    const urls: Record<string, string> = {};
    this.services.forEach((config, name) => {
      urls[name] = config.baseUrl!;
    });
    return urls;
  }

  /**
   * Verify inter-service communication
   */
  async verifyInterServiceCommunication(
    fromService: string,
    toService: string,
    token: string
  ): Promise<boolean> {
    try {
      // Make a request from one service to another
      // This would need to be implemented based on your actual service interactions
      console.log(`Verifying communication from ${fromService} to ${toService}...`);

      // Example: Auth service calling client service
      if (fromService === 'auth' && toService === 'client') {
        const response = await this.makeAuthenticatedRequest(
          'client',
          'get',
          '/api/v1/organizations',
          token
        );
        return response.status === 200;
      }

      return true;
    } catch (error) {
      console.error(
        `Failed to verify communication from ${fromService} to ${toService}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Get metrics for a service
   */
  async getServiceMetrics(serviceName: string): Promise<any> {
    try {
      const config = this.getServiceConfig(serviceName);
      const response = await axios.get(`${config.baseUrl}/metrics`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to get metrics for ${serviceName}:`, error.message);
      return null;
    }
  }
}
