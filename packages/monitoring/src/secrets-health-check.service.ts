import { Injectable, Logger } from '@nestjs/common';
import { SecretsMonitoringService } from './secrets-monitoring.service';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: Record<string, any>;
  timestamp: Date;
  responseTime: number;
}

export interface SecretsHealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  providers: HealthCheckResult[];
  secrets: HealthCheckResult;
  cache: HealthCheckResult;
  audit: HealthCheckResult;
  security: HealthCheckResult;
  lastUpdated: Date;
}

export interface ProviderHealthChecker {
  checkHealth(): Promise<HealthCheckResult>;
}

@Injectable()
export class SecretsHealthCheckService {
  private readonly logger = new Logger(SecretsHealthCheckService.name);
  private readonly healthCheckers = new Map<string, ProviderHealthChecker>();
  private healthCache = new Map<string, HealthCheckResult>();
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor(private readonly monitoring: SecretsMonitoringService) {}

  /**
   * Register a health checker for a specific provider
   */
  registerProviderHealthChecker(providerName: string, checker: ProviderHealthChecker): void {
    this.healthCheckers.set(providerName, checker);
    this.logger.debug(`Registered health checker for provider: ${providerName}`);
  }

  /**
   * Check the health of all secrets management components
   */
  async checkOverallHealth(): Promise<SecretsHealthStatus> {
    const startTime = Date.now();

    try {
      // Check provider health
      const providerChecks = await this.checkProvidersHealth();

      // Check secrets freshness (rotation due dates)
      const secretsCheck = await this.checkSecretsFreshness();

      // Check cache performance
      const cacheCheck = await this.checkCacheHealth();

      // Check audit log health
      const auditCheck = await this.checkAuditLogHealth();

      // Check security status
      const securityCheck = await this.checkSecurityStatus();

      // Determine overall health
      const allChecks = [secretsCheck, cacheCheck, auditCheck, securityCheck, ...providerChecks];
      const unhealthy = allChecks.filter((check) => check.status === 'unhealthy');
      const degraded = allChecks.filter((check) => check.status === 'degraded');

      let overall: 'healthy' | 'unhealthy' | 'degraded';
      if (unhealthy.length > 0) {
        overall = 'unhealthy';
      } else if (degraded.length > 0) {
        overall = 'degraded';
      } else {
        overall = 'healthy';
      }

      const result: SecretsHealthStatus = {
        overall,
        providers: providerChecks,
        secrets: secretsCheck,
        cache: cacheCheck,
        audit: auditCheck,
        security: securityCheck,
        lastUpdated: new Date(),
      };

      const duration = (Date.now() - startTime) / 1000;
      this.logger.debug(`Health check completed in ${duration}s - overall status: ${overall}`);

      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check health of all registered providers
   */
  private async checkProvidersHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [providerName, checker] of this.healthCheckers) {
      try {
        const cached = this.getCachedResult(`provider_${providerName}`);
        if (cached) {
          results.push(cached);
          continue;
        }

        const startTime = Date.now();
        const result = await checker.checkHealth();
        const responseTime = (Date.now() - startTime) / 1000;

        // Update monitoring metrics
        this.monitoring.recordProviderHealth(
          providerName,
          result.details.endpoint || 'unknown',
          result.status === 'healthy',
          responseTime
        );

        this.cacheResult(`provider_${providerName}`, result);
        results.push(result);
      } catch (error) {
        this.logger.error(`Provider health check failed for ${providerName}: ${error.message}`);

        const errorResult: HealthCheckResult = {
          name: providerName,
          status: 'unhealthy',
          details: { error: error.message },
          timestamp: new Date(),
          responseTime: 0,
        };

        this.monitoring.recordProviderError(providerName, 'health_check_failure');
        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * Check secrets freshness and rotation status
   */
  private async checkSecretsFreshness(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const cached = this.getCachedResult('secrets_freshness');
      if (cached) {
        return cached;
      }

      // This would typically query the secrets management system
      // For now, we'll simulate the check
      const rotationsDue = await this.getRotationsDueCount();
      const expiredSecrets = await this.getExpiredSecretsCount();
      const totalSecrets = await this.getTotalSecretsCount();

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (expiredSecrets > 0) {
        status = 'unhealthy';
      } else if (rotationsDue > totalSecrets * 0.1) {
        // More than 10% due for rotation
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      const result: HealthCheckResult = {
        name: 'secrets_freshness',
        status,
        details: {
          totalSecrets,
          rotationsDue,
          expiredSecrets,
          rotationDuePercentage: Math.round((rotationsDue / totalSecrets) * 100),
        },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };

      this.cacheResult('secrets_freshness', result);
      return result;
    } catch (error) {
      this.logger.error(`Secrets freshness check failed: ${error.message}`);
      return {
        name: 'secrets_freshness',
        status: 'unhealthy',
        details: { error: error.message },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Check cache performance and health
   */
  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const cached = this.getCachedResult('cache_health');
      if (cached) {
        return cached;
      }

      // Get cache statistics
      const stats = await this.getCacheStats();

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (stats.hitRatio < 0.5) {
        // Less than 50% hit ratio
        status = 'degraded';
      } else if (stats.errorRate > 0.01) {
        // More than 1% error rate
        status = 'unhealthy';
      } else {
        status = 'healthy';
      }

      const result: HealthCheckResult = {
        name: 'cache_health',
        status,
        details: {
          hitRatio: stats.hitRatio,
          missRatio: stats.missRatio,
          errorRate: stats.errorRate,
          entriesCount: stats.entriesCount,
          sizeBytes: stats.sizeBytes,
          avgTTL: stats.avgTTL,
        },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };

      this.cacheResult('cache_health', result);
      return result;
    } catch (error) {
      this.logger.error(`Cache health check failed: ${error.message}`);
      return {
        name: 'cache_health',
        status: 'unhealthy',
        details: { error: error.message },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Check audit log health and completeness
   */
  private async checkAuditLogHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const cached = this.getCachedResult('audit_health');
      if (cached) {
        return cached;
      }

      const stats = await this.getAuditStats();

      let status: 'healthy' | 'unhealthy' | 'degraded';
      const timeSinceLastLog = Date.now() - stats.lastLogTimestamp;

      if (timeSinceLastLog > 300000) {
        // More than 5 minutes
        status = 'unhealthy';
      } else if (stats.errorRate > 0.05) {
        // More than 5% error rate
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      const result: HealthCheckResult = {
        name: 'audit_health',
        status,
        details: {
          lastLogAge: Math.round(timeSinceLastLog / 1000),
          eventsPerMinute: stats.eventsPerMinute,
          errorRate: stats.errorRate,
          totalEvents: stats.totalEvents,
          storageHealth: stats.storageHealth,
        },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };

      this.cacheResult('audit_health', result);
      return result;
    } catch (error) {
      this.logger.error(`Audit health check failed: ${error.message}`);
      return {
        name: 'audit_health',
        status: 'unhealthy',
        details: { error: error.message },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Check security status and violations
   */
  private async checkSecurityStatus(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const cached = this.getCachedResult('security_status');
      if (cached) {
        return cached;
      }

      const stats = await this.getSecurityStats();

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (stats.criticalViolations > 0) {
        status = 'unhealthy';
      } else if (stats.recentViolations > 10) {
        // More than 10 violations in last hour
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      const result: HealthCheckResult = {
        name: 'security_status',
        status,
        details: {
          criticalViolations: stats.criticalViolations,
          recentViolations: stats.recentViolations,
          rateLimitViolations: stats.rateLimitViolations,
          suspiciousPatterns: stats.suspiciousPatterns,
          activeThreats: stats.activeThreats,
        },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };

      this.cacheResult('security_status', result);
      return result;
    } catch (error) {
      this.logger.error(`Security status check failed: ${error.message}`);
      return {
        name: 'security_status',
        status: 'unhealthy',
        details: { error: error.message },
        timestamp: new Date(),
        responseTime: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Cache health check result
   */
  private cacheResult(key: string, result: HealthCheckResult): void {
    this.healthCache.set(key, result);

    // Set timeout to clear cache
    setTimeout(() => {
      this.healthCache.delete(key);
    }, this.cacheTimeout);
  }

  /**
   * Get cached health check result if still valid
   */
  private getCachedResult(key: string): HealthCheckResult | null {
    const cached = this.healthCache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.cacheTimeout) {
        return cached;
      }
      this.healthCache.delete(key);
    }
    return null;
  }

  // Placeholder methods - would be implemented to query actual systems
  private async getRotationsDueCount(): Promise<number> {
    // Implementation would query secrets management system
    return 0;
  }

  private async getExpiredSecretsCount(): Promise<number> {
    // Implementation would query secrets management system
    return 0;
  }

  private async getTotalSecretsCount(): Promise<number> {
    // Implementation would query secrets management system
    return 100;
  }

  private async getCacheStats(): Promise<{
    hitRatio: number;
    missRatio: number;
    errorRate: number;
    entriesCount: number;
    sizeBytes: number;
    avgTTL: number;
  }> {
    // Implementation would query cache system
    return {
      hitRatio: 0.85,
      missRatio: 0.15,
      errorRate: 0.001,
      entriesCount: 1000,
      sizeBytes: 1024 * 1024,
      avgTTL: 3600,
    };
  }

  private async getAuditStats(): Promise<{
    lastLogTimestamp: number;
    eventsPerMinute: number;
    errorRate: number;
    totalEvents: number;
    storageHealth: boolean;
  }> {
    // Implementation would query audit system
    return {
      lastLogTimestamp: Date.now() - 30000,
      eventsPerMinute: 10,
      errorRate: 0.01,
      totalEvents: 50000,
      storageHealth: true,
    };
  }

  private async getSecurityStats(): Promise<{
    criticalViolations: number;
    recentViolations: number;
    rateLimitViolations: number;
    suspiciousPatterns: number;
    activeThreats: number;
  }> {
    // Implementation would query security monitoring system
    return {
      criticalViolations: 0,
      recentViolations: 2,
      rateLimitViolations: 1,
      suspiciousPatterns: 0,
      activeThreats: 0,
    };
  }
}
