import { Logger } from '@nestjs/common';

export interface ServiceApiKeyConfig {
  serviceName: string;
  apiKey: string;
  isDefault: boolean;
}

/**
 * Default API keys for development environments
 * These should NEVER be used in production
 */
const DEFAULT_API_KEYS: Record<string, string> = {
  'auth-service': 'dev-auth-service-api-key-2024',
  'client-service': 'dev-client-service-api-key-2024',
  'policy-service': 'dev-policy-service-api-key-2024',
  'control-service': 'dev-control-service-api-key-2024',
  'evidence-service': 'dev-evidence-service-api-key-2024',
  'workflow-service': 'dev-workflow-service-api-key-2024',
  'reporting-service': 'dev-reporting-service-api-key-2024',
  'audit-service': 'dev-audit-service-api-key-2024',
  'integration-service': 'dev-integration-service-api-key-2024',
  'notification-service': 'dev-notification-service-api-key-2024',
  'ai-service': 'dev-ai-service-api-key-2024',
};

export class ServiceApiKeysConfig {
  private static logger = new Logger(ServiceApiKeysConfig.name);
  private static apiKeys: Map<string, ServiceApiKeyConfig> = new Map();
  private static initialized = false;

  /**
   * Initialize service API keys from environment or defaults
   */
  static initialize(): void {
    if (ServiceApiKeysConfig.initialized) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const services = Object.keys(DEFAULT_API_KEYS);

    services.forEach((service) => {
      const envVarName = `SERVICE_API_KEY_${service.toUpperCase().replace('-', '_')}`;
      const apiKey = process.env[envVarName];

      if (apiKey) {
        // Use environment variable
        ServiceApiKeysConfig.apiKeys.set(service, {
          serviceName: service,
          apiKey,
          isDefault: false,
        });
      } else if (!isProduction) {
        // Use default in development
        ServiceApiKeysConfig.logger.warn(
          `No API key found for ${service}, using default for development`
        );
        ServiceApiKeysConfig.apiKeys.set(service, {
          serviceName: service,
          apiKey: DEFAULT_API_KEYS[service],
          isDefault: true,
        });
      } else {
        // Error in production
        ServiceApiKeysConfig.logger.error(`No API key configured for ${service} in production!`);
      }
    });

    ServiceApiKeysConfig.initialized = true;
  }

  /**
   * Get API key for a service
   */
  static getApiKey(serviceName: string): string | undefined {
    ServiceApiKeysConfig.initialize();
    return ServiceApiKeysConfig.apiKeys.get(serviceName)?.apiKey;
  }

  /**
   * Get all configured service API keys
   */
  static getAllApiKeys(): Map<string, ServiceApiKeyConfig> {
    ServiceApiKeysConfig.initialize();
    return new Map(ServiceApiKeysConfig.apiKeys);
  }

  /**
   * Check if a service is using default API key
   */
  static isUsingDefault(serviceName: string): boolean {
    ServiceApiKeysConfig.initialize();
    return ServiceApiKeysConfig.apiKeys.get(serviceName)?.isDefault || false;
  }

  /**
   * Validate an API key for a service
   */
  static validateApiKey(serviceName: string, apiKey: string): boolean {
    ServiceApiKeysConfig.initialize();
    const config = ServiceApiKeysConfig.apiKeys.get(serviceName);
    return config?.apiKey === apiKey;
  }

  /**
   * Get service JWT secret with fallback
   */
  static getServiceJwtSecret(): string {
    const secret = process.env.SERVICE_JWT_SECRET;

    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('SERVICE_JWT_SECRET must be configured in production');
    }

    return secret || 'dev-service-jwt-secret-key-2024-do-not-use-in-production';
  }
}
