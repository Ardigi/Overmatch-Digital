import { Injectable, Logger } from '@nestjs/common';
import type * as promClient from 'prom-client';
import { MetricsService } from './metrics';

export interface SecretsMetrics {
  // Access metrics
  recordSecretAccess(
    provider: string,
    secretName: string,
    operation: string,
    result: 'success' | 'failure',
    duration: number
  ): void;

  // Rotation metrics
  recordSecretRotation(
    provider: string,
    secretName: string,
    result: 'success' | 'failure',
    duration: number
  ): void;
  updateRotationDueCount(provider: string, count: number): void;
  updateExpiredCount(provider: string, count: number): void;

  // Provider health metrics
  recordProviderHealth(
    provider: string,
    endpoint: string,
    isHealthy: boolean,
    responseTime: number
  ): void;
  recordProviderError(provider: string, errorType: string): void;

  // Cache metrics
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    result: 'success' | 'failure'
  ): void;
  updateCacheStats(sizeBytes: number, entryCount: number): void;
  recordCacheTTL(ttlSeconds: number): void;

  // Security metrics
  recordAuditEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void;
  recordSecurityViolation(
    violationType: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void;
  recordRateLimitViolation(userId: string, secretName: string): void;

  // Circuit breaker metrics
  updateCircuitBreakerState(
    provider: string,
    circuitName: string,
    state: 'closed' | 'open' | 'half-open'
  ): void;
  recordCircuitBreakerTrip(provider: string, circuitName: string): void;
}

@Injectable()
export class SecretsMonitoringService implements SecretsMetrics {
  private readonly logger = new Logger(SecretsMonitoringService.name);

  // Metrics instances
  private readonly secretsAccessTotal: promClient.Counter<string>;
  private readonly secretsAccessDuration: promClient.Histogram<string>;
  private readonly secretsRotationTotal: promClient.Counter<string>;
  private readonly secretsRotationDuration: promClient.Histogram<string>;
  private readonly secretsRotationDueCount: promClient.Gauge<string>;
  private readonly secretsExpiredCount: promClient.Gauge<string>;
  private readonly providerHealthStatus: promClient.Gauge<string>;
  private readonly providerResponseTime: promClient.Histogram<string>;
  private readonly providerErrorsTotal: promClient.Counter<string>;
  private readonly cacheOperationsTotal: promClient.Counter<string>;
  private readonly cacheSizeBytes: promClient.Gauge<string>;
  private readonly cacheEntriesCount: promClient.Gauge<string>;
  private readonly cacheTTL: promClient.Histogram<string>;
  private readonly auditEventsTotal: promClient.Counter<string>;
  private readonly securityViolationsTotal: promClient.Counter<string>;
  private readonly rateLimitViolations: promClient.Gauge<string>;
  private readonly circuitBreakerState: promClient.Gauge<string>;
  private readonly circuitBreakerTripsTotal: promClient.Counter<string>;

  constructor(private readonly metricsService: MetricsService) {
    // Initialize secrets-specific metrics
    this.secretsAccessTotal = this.metricsService.getMetric(
      'secrets_access_total'
    ) as promClient.Counter<string>;
    this.secretsAccessDuration = this.metricsService.getMetric(
      'secrets_access_duration_seconds'
    ) as promClient.Histogram<string>;
    this.secretsRotationTotal = this.metricsService.getMetric(
      'secrets_rotation_total'
    ) as promClient.Counter<string>;
    this.secretsRotationDuration = this.metricsService.getMetric(
      'secrets_rotation_duration_seconds'
    ) as promClient.Histogram<string>;
    this.secretsRotationDueCount = this.metricsService.getMetric(
      'secrets_rotation_due_count'
    ) as promClient.Gauge<string>;
    this.secretsExpiredCount = this.metricsService.getMetric(
      'secrets_expired_count'
    ) as promClient.Gauge<string>;
    this.providerHealthStatus = this.metricsService.getMetric(
      'secrets_provider_health_status'
    ) as promClient.Gauge<string>;
    this.providerResponseTime = this.metricsService.getMetric(
      'secrets_provider_response_time_seconds'
    ) as promClient.Histogram<string>;
    this.providerErrorsTotal = this.metricsService.getMetric(
      'secrets_provider_errors_total'
    ) as promClient.Counter<string>;
    this.cacheOperationsTotal = this.metricsService.getMetric(
      'secrets_cache_operations_total'
    ) as promClient.Counter<string>;
    this.cacheSizeBytes = this.metricsService.getMetric(
      'secrets_cache_size_bytes'
    ) as promClient.Gauge<string>;
    this.cacheEntriesCount = this.metricsService.getMetric(
      'secrets_cache_entries_count'
    ) as promClient.Gauge<string>;
    this.cacheTTL = this.metricsService.getMetric(
      'secrets_cache_ttl_seconds'
    ) as promClient.Histogram<string>;
    this.auditEventsTotal = this.metricsService.getMetric(
      'secrets_audit_events_total'
    ) as promClient.Counter<string>;
    this.securityViolationsTotal = this.metricsService.getMetric(
      'secrets_security_violations_total'
    ) as promClient.Counter<string>;
    this.rateLimitViolations = this.metricsService.getMetric(
      'secrets_access_rate_limit_violations'
    ) as promClient.Gauge<string>;
    this.circuitBreakerState = this.metricsService.getMetric(
      'secrets_circuit_breaker_state'
    ) as promClient.Gauge<string>;
    this.circuitBreakerTripsTotal = this.metricsService.getMetric(
      'secrets_circuit_breaker_trips_total'
    ) as promClient.Counter<string>;
  }

  recordSecretAccess(
    provider: string,
    secretName: string,
    operation: string,
    result: 'success' | 'failure',
    duration: number
  ): void {
    try {
      const labels = {
        provider,
        secret_name: secretName,
        operation,
        result,
        service: this.metricsService.config.serviceName,
      };

      this.secretsAccessTotal.inc(labels);
      this.secretsAccessDuration.observe(
        { provider, operation, service: this.metricsService.config.serviceName },
        duration
      );

      this.logger.debug(
        `Recorded secret access: ${provider}/${secretName} ${operation} ${result} (${duration}s)`
      );
    } catch (error) {
      this.logger.error(`Failed to record secret access metric: ${error.message}`);
    }
  }

  recordSecretRotation(
    provider: string,
    secretName: string,
    result: 'success' | 'failure',
    duration: number
  ): void {
    try {
      const labels = {
        provider,
        secret_name: secretName,
        result,
        service: this.metricsService.config.serviceName,
      };

      this.secretsRotationTotal.inc(labels);
      this.secretsRotationDuration.observe(
        { provider, service: this.metricsService.config.serviceName },
        duration
      );

      this.logger.debug(
        `Recorded secret rotation: ${provider}/${secretName} ${result} (${duration}s)`
      );
    } catch (error) {
      this.logger.error(`Failed to record secret rotation metric: ${error.message}`);
    }
  }

  updateRotationDueCount(provider: string, count: number): void {
    try {
      this.secretsRotationDueCount.set(
        { provider, service: this.metricsService.config.serviceName },
        count
      );
      this.logger.debug(`Updated rotation due count for ${provider}: ${count}`);
    } catch (error) {
      this.logger.error(`Failed to update rotation due count: ${error.message}`);
    }
  }

  updateExpiredCount(provider: string, count: number): void {
    try {
      this.secretsExpiredCount.set(
        { provider, service: this.metricsService.config.serviceName },
        count
      );
      this.logger.debug(`Updated expired count for ${provider}: ${count}`);
    } catch (error) {
      this.logger.error(`Failed to update expired count: ${error.message}`);
    }
  }

  recordProviderHealth(
    provider: string,
    endpoint: string,
    isHealthy: boolean,
    responseTime: number
  ): void {
    try {
      const labels = {
        provider,
        endpoint,
        service: this.metricsService.config.serviceName,
      };

      this.providerHealthStatus.set(labels, isHealthy ? 1 : 0);
      this.providerResponseTime.observe(
        { provider, service: this.metricsService.config.serviceName },
        responseTime
      );

      this.logger.debug(
        `Recorded provider health: ${provider}/${endpoint} healthy=${isHealthy} (${responseTime}s)`
      );
    } catch (error) {
      this.logger.error(`Failed to record provider health metric: ${error.message}`);
    }
  }

  recordProviderError(provider: string, errorType: string): void {
    try {
      this.providerErrorsTotal.inc({
        provider,
        error_type: errorType,
        service: this.metricsService.config.serviceName,
      });

      this.logger.debug(`Recorded provider error: ${provider} ${errorType}`);
    } catch (error) {
      this.logger.error(`Failed to record provider error metric: ${error.message}`);
    }
  }

  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    result: 'success' | 'failure'
  ): void {
    try {
      this.cacheOperationsTotal.inc({
        operation,
        result,
        service: this.metricsService.config.serviceName,
      });

      this.logger.debug(`Recorded cache operation: ${operation} ${result}`);
    } catch (error) {
      this.logger.error(`Failed to record cache operation metric: ${error.message}`);
    }
  }

  updateCacheStats(sizeBytes: number, entryCount: number): void {
    try {
      this.cacheSizeBytes.set({ service: this.metricsService.config.serviceName }, sizeBytes);
      this.cacheEntriesCount.set({ service: this.metricsService.config.serviceName }, entryCount);

      this.logger.debug(`Updated cache stats: ${sizeBytes} bytes, ${entryCount} entries`);
    } catch (error) {
      this.logger.error(`Failed to update cache stats: ${error.message}`);
    }
  }

  recordCacheTTL(ttlSeconds: number): void {
    try {
      this.cacheTTL.observe({ service: this.metricsService.config.serviceName }, ttlSeconds);
      this.logger.debug(`Recorded cache TTL: ${ttlSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to record cache TTL metric: ${error.message}`);
    }
  }

  recordAuditEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    try {
      this.auditEventsTotal.inc({
        event_type: eventType,
        severity,
        service: this.metricsService.config.serviceName,
      });

      this.logger.debug(`Recorded audit event: ${eventType} ${severity}`);
    } catch (error) {
      this.logger.error(`Failed to record audit event metric: ${error.message}`);
    }
  }

  recordSecurityViolation(
    violationType: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    try {
      this.securityViolationsTotal.inc({
        violation_type: violationType,
        severity,
        service: this.metricsService.config.serviceName,
      });

      this.logger.warn(`Recorded security violation: ${violationType} ${severity}`);
    } catch (error) {
      this.logger.error(`Failed to record security violation metric: ${error.message}`);
    }
  }

  recordRateLimitViolation(userId: string, secretName: string): void {
    try {
      this.rateLimitViolations.inc({
        user_id: userId,
        secret_name: secretName,
        service: this.metricsService.config.serviceName,
      });

      this.logger.warn(`Recorded rate limit violation: user=${userId} secret=${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to record rate limit violation metric: ${error.message}`);
    }
  }

  updateCircuitBreakerState(
    provider: string,
    circuitName: string,
    state: 'closed' | 'open' | 'half-open'
  ): void {
    try {
      const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
      this.circuitBreakerState.set(
        {
          provider,
          circuit_name: circuitName,
          service: this.metricsService.config.serviceName,
        },
        stateValue
      );

      this.logger.debug(`Updated circuit breaker state: ${provider}/${circuitName} = ${state}`);
    } catch (error) {
      this.logger.error(`Failed to update circuit breaker state: ${error.message}`);
    }
  }

  recordCircuitBreakerTrip(provider: string, circuitName: string): void {
    try {
      this.circuitBreakerTripsTotal.inc({
        provider,
        circuit_name: circuitName,
        service: this.metricsService.config.serviceName,
      });

      this.logger.warn(`Recorded circuit breaker trip: ${provider}/${circuitName}`);
    } catch (error) {
      this.logger.error(`Failed to record circuit breaker trip metric: ${error.message}`);
    }
  }

  /**
   * Get aggregated secrets health metrics
   */
  async getSecretsHealthSummary(): Promise<{
    totalAccess: number;
    successRate: number;
    rotationsDue: number;
    expiredSecrets: number;
    providerHealth: Record<string, boolean>;
    cacheHitRatio: number;
    securityViolations: number;
  }> {
    try {
      const metrics = await this.metricsService.getMetrics();
      // Parse metrics to calculate summary (simplified for brevity)
      return {
        totalAccess: 0, // Parse from metrics
        successRate: 0, // Calculate from success/failure ratios
        rotationsDue: 0, // Sum across providers
        expiredSecrets: 0, // Sum across providers
        providerHealth: {}, // Extract health status per provider
        cacheHitRatio: 0, // Calculate from hit/miss ratios
        securityViolations: 0, // Sum security violations
      };
    } catch (error) {
      this.logger.error(`Failed to get secrets health summary: ${error.message}`);
      throw error;
    }
  }
}
