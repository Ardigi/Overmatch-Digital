import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// SecretsManagerService is optional - using infrastructure-level secrets via env vars
// import { SecretsManagerService } from '@soc-compliance/secrets';

/**
 * Service to provide configuration values from secrets or environment variables
 * with backward compatibility for existing .env files
 */
@Injectable()
export class DynamicConfigService implements OnModuleInit {
  private readonly logger = new Logger(DynamicConfigService.name);
  private secretsAvailable = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly secretsManager?: any // SecretsManagerService - optional, using env vars
  ) {}

  async onModuleInit() {
    // Test if secrets service is available
    if (this.secretsManager) {
      try {
        const healthCheck = await this.secretsManager.healthCheck();
        this.secretsAvailable = Object.values(healthCheck).some((healthy) => healthy);
        this.logger.log(`Secrets service availability: ${this.secretsAvailable}`);
      } catch (error) {
        this.logger.warn('Secrets service not available, falling back to environment variables');
        this.secretsAvailable = false;
      }
    }
  }

  /**
   * Get configuration value with fallback priority:
   * 1. Secrets manager (if available)
   * 2. Environment variable
   * 3. Default value
   */
  async get(key: string, defaultValue?: string): Promise<string | undefined> {
    try {
      // Try secrets first if available
      if (this.secretsAvailable && this.secretsManager) {
        const secretValue = await this.secretsManager.getSecret(key);
        if (secretValue !== null) {
          this.logger.debug(`Retrieved ${key} from secrets manager`);
          return secretValue;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to get ${key} from secrets manager: ${error.message}`);
    }

    // Fallback to environment variable
    const envValue = this.configService.get(key, defaultValue);
    if (envValue !== undefined) {
      this.logger.debug(`Retrieved ${key} from environment variables`);
      return envValue;
    }

    this.logger.warn(`Configuration key ${key} not found in secrets or environment`);
    return defaultValue;
  }

  /**
   * Get multiple configuration values at once
   */
  async getMultiple(keys: string[]): Promise<Record<string, string | undefined>> {
    const results: Record<string, string | undefined> = {};

    try {
      // Try secrets first if available
      if (this.secretsAvailable && this.secretsManager) {
        const secretResults = await this.secretsManager.getSecrets(keys);
        for (const [key, value] of Object.entries(secretResults)) {
          if (value !== null) {
            results[key] = String(value);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to get multiple secrets: ${error.message}`);
    }

    // Fill in missing values from environment
    for (const key of keys) {
      if (results[key] === undefined) {
        results[key] = this.configService.get(key);
      }
    }

    return results;
  }

  /**
   * Check if secrets service is healthy
   */
  async isSecretsHealthy(): Promise<boolean> {
    if (!this.secretsManager) {
      return false;
    }

    try {
      const healthCheck = await this.secretsManager.healthCheck();
      return Object.values(healthCheck).some((healthy) => healthy);
    } catch {
      return false;
    }
  }

  /**
   * Get JWT configuration with secret rotation support
   */
  async getJwtConfig(): Promise<{
    secret: string;
    expiresIn: string;
    clockTolerance: number;
  }> {
    const [secret, expiresIn] = await Promise.all([
      this.get('JWT_SECRET'),
      this.get('JWT_EXPIRATION', '8h'),
    ]);

    if (!secret) {
      throw new Error('JWT_SECRET is required but not found in secrets or environment');
    }

    return {
      secret,
      expiresIn,
      clockTolerance: 30, // 30 seconds tolerance
    };
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig(): Promise<{
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  }> {
    const config = await this.getMultiple([
      'DB_HOST',
      'DB_PORT',
      'DB_USERNAME',
      'DB_PASSWORD',
      'DB_NAME',
    ]);

    return {
      host: config.DB_HOST || '127.0.0.1',
      port: parseInt(config.DB_PORT || '5432'),
      username: config.DB_USERNAME || 'soc_user',
      password: config.DB_PASSWORD || 'soc_pass',
      database: config.DB_NAME || 'soc_auth',
    };
  }

  /**
   * Get Redis configuration
   */
  async getRedisConfig(): Promise<{
    host: string;
    port: number;
    password?: string;
  }> {
    const config = await this.getMultiple(['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD']);

    return {
      host: config.REDIS_HOST || 'localhost',
      port: parseInt(config.REDIS_PORT || '6379'),
      password: config.REDIS_PASSWORD,
    };
  }
}
