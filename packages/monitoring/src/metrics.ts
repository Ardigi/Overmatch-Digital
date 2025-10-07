import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';
import type { MetricsConfig } from './interfaces';
import './types';

@Injectable()
export class MetricsService {
  private readonly register: promClient.Registry;
  private readonly httpRequestDuration: promClient.Histogram<string>;
  private readonly httpRequestsTotal: promClient.Counter<string>;
  private readonly httpRequestsInFlight: promClient.Gauge<string>;
  private readonly dbQueryDuration: promClient.Histogram<string>;
  private readonly cacheHits: promClient.Counter<string>;
  private readonly cacheMisses: promClient.Counter<string>;
  private readonly businessMetrics: Map<
    string,
    promClient.Counter<string> | promClient.Gauge<string> | promClient.Histogram<string>
  >;
  public readonly config: MetricsConfig;

  constructor(config: MetricsConfig) {
    this.config = config;
    this.register = new promClient.Registry();
    this.businessMetrics = new Map();

    // Set default labels
    if (config.defaultLabels) {
      this.register.setDefaultLabels(config.defaultLabels);
    }

    // Enable default metrics if configured
    if (config.enableDefaultMetrics !== false) {
      promClient.collectDefaultMetrics({
        register: this.register,
        prefix: config.prefix,
      });
    }

    // HTTP metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: `${config.prefix || ''}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    this.httpRequestsTotal = new promClient.Counter({
      name: `${config.prefix || ''}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.register],
    });

    this.httpRequestsInFlight = new promClient.Gauge({
      name: `${config.prefix || ''}http_requests_in_flight`,
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route', 'service'],
      registers: [this.register],
    });

    // Database metrics
    this.dbQueryDuration = new promClient.Histogram({
      name: `${config.prefix || ''}db_query_duration_seconds`,
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Cache metrics
    this.cacheHits = new promClient.Counter({
      name: `${config.prefix || ''}cache_hits_total`,
      help: 'Total number of cache hits',
      labelNames: ['cache_name', 'service'],
      registers: [this.register],
    });

    this.cacheMisses = new promClient.Counter({
      name: `${config.prefix || ''}cache_misses_total`,
      help: 'Total number of cache misses',
      labelNames: ['cache_name', 'service'],
      registers: [this.register],
    });
  }

  // HTTP metrics methods
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      service: this.config.serviceName,
    };

    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestsTotal.inc(labels);
  }

  incrementHttpRequestsInFlight(method: string, route: string): void {
    this.httpRequestsInFlight.inc({
      method,
      route,
      service: this.config.serviceName,
    });
  }

  decrementHttpRequestsInFlight(method: string, route: string): void {
    this.httpRequestsInFlight.dec({
      method,
      route,
      service: this.config.serviceName,
    });
  }

  // Database metrics methods
  recordDbQuery(operation: string, table: string, duration: number): void {
    this.dbQueryDuration.observe(
      {
        operation,
        table,
        service: this.config.serviceName,
      },
      duration
    );
  }

  // Cache metrics methods
  recordCacheHit(cacheName: string): void {
    this.cacheHits.inc({
      cache_name: cacheName,
      service: this.config.serviceName,
    });
  }

  recordCacheMiss(cacheName: string): void {
    this.cacheMisses.inc({
      cache_name: cacheName,
      service: this.config.serviceName,
    });
  }

  // Business metrics methods
  registerCounter(name: string, help: string, labelNames?: string[]): promClient.Counter<string> {
    const counter = new promClient.Counter({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames: [...(labelNames || []), 'service'],
      registers: [this.register],
    });
    this.businessMetrics.set(name, counter);
    return counter;
  }

  registerGauge(name: string, help: string, labelNames?: string[]): promClient.Gauge<string> {
    const gauge = new promClient.Gauge({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames: [...(labelNames || []), 'service'],
      registers: [this.register],
    });
    this.businessMetrics.set(name, gauge);
    return gauge;
  }

  registerHistogram(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[]
  ): promClient.Histogram<string> {
    const histogram = new promClient.Histogram({
      name: `${this.config.prefix || ''}${name}`,
      help,
      labelNames: [...(labelNames || []), 'service'],
      buckets,
      registers: [this.register],
    });
    this.businessMetrics.set(name, histogram);
    return histogram;
  }

  // Secrets Management specific metrics
  registerSecretsMetrics(): void {
    // Secret access metrics
    this.registerCounter('secrets_access_total', 'Total number of secret access operations', [
      'provider',
      'secret_name',
      'operation',
      'result',
    ]);

    this.registerHistogram(
      'secrets_access_duration_seconds',
      'Duration of secret access operations in seconds',
      ['provider', 'operation'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    );

    // Secret rotation metrics
    this.registerCounter('secrets_rotation_total', 'Total number of secret rotation operations', [
      'provider',
      'secret_name',
      'result',
    ]);

    this.registerHistogram(
      'secrets_rotation_duration_seconds',
      'Duration of secret rotation operations in seconds',
      ['provider'],
      [1, 5, 10, 30, 60, 300, 600, 1800]
    );

    this.registerGauge('secrets_rotation_due_count', 'Number of secrets due for rotation', [
      'provider',
    ]);

    this.registerGauge('secrets_expired_count', 'Number of expired secrets', ['provider']);

    // Provider health metrics
    this.registerGauge(
      'secrets_provider_health_status',
      'Health status of secrets providers (1=healthy, 0=unhealthy)',
      ['provider', 'endpoint']
    );

    this.registerHistogram(
      'secrets_provider_response_time_seconds',
      'Response time of secrets provider health checks',
      ['provider'],
      [0.1, 0.5, 1, 2, 5, 10, 30]
    );

    this.registerCounter('secrets_provider_errors_total', 'Total number of provider errors', [
      'provider',
      'error_type',
    ]);

    // Cache metrics for secrets
    this.registerCounter(
      'secrets_cache_operations_total',
      'Total number of secrets cache operations',
      ['operation', 'result']
    );

    this.registerGauge('secrets_cache_size_bytes', 'Current size of secrets cache in bytes', []);

    this.registerGauge('secrets_cache_entries_count', 'Number of entries in secrets cache', []);

    this.registerHistogram(
      'secrets_cache_ttl_seconds',
      'TTL distribution of cached secrets',
      [],
      [60, 300, 900, 1800, 3600, 7200, 14400, 28800]
    );

    // Security and audit metrics
    this.registerCounter('secrets_audit_events_total', 'Total number of secrets audit events', [
      'event_type',
      'severity',
    ]);

    this.registerCounter(
      'secrets_security_violations_total',
      'Total number of security violations',
      ['violation_type', 'severity']
    );

    this.registerGauge('secrets_access_rate_limit_violations', 'Number of rate limit violations', [
      'user_id',
      'secret_name',
    ]);

    // Circuit breaker metrics
    this.registerGauge(
      'secrets_circuit_breaker_state',
      'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      ['provider', 'circuit_name']
    );

    this.registerCounter(
      'secrets_circuit_breaker_trips_total',
      'Total number of circuit breaker trips',
      ['provider', 'circuit_name']
    );
  }

  // SOC Compliance specific metrics
  registerComplianceMetrics(): void {
    // Compliance check metrics
    this.registerCounter('compliance_checks_total', 'Total number of compliance checks performed', [
      'framework',
      'control_id',
      'result',
    ]);

    this.registerGauge('compliance_score', 'Current compliance score', [
      'framework',
      'organization_id',
    ]);

    this.registerHistogram(
      'compliance_check_duration_seconds',
      'Duration of compliance checks in seconds',
      ['framework', 'control_id'],
      [0.1, 0.5, 1, 5, 10, 30, 60]
    );

    // Audit metrics
    this.registerCounter('audit_events_total', 'Total number of audit events', [
      'event_type',
      'user_id',
      'organization_id',
    ]);

    this.registerGauge('audit_log_size_bytes', 'Current size of audit logs in bytes', [
      'organization_id',
    ]);

    // Security metrics
    this.registerCounter('auth_attempts_total', 'Total number of authentication attempts', [
      'method',
      'result',
    ]);

    this.registerCounter(
      'unauthorized_access_attempts_total',
      'Total number of unauthorized access attempts',
      ['resource', 'user_id']
    );

    this.registerCounter('mfa_verifications_total', 'Total number of MFA verifications', [
      'method',
      'result',
    ]);

    // Evidence metrics
    this.registerCounter('evidence_uploads_total', 'Total number of evidence uploads', [
      'type',
      'organization_id',
    ]);

    this.registerGauge('evidence_storage_bytes', 'Current evidence storage usage in bytes', [
      'organization_id',
    ]);

    // Workflow metrics
    this.registerGauge('active_workflows', 'Number of active workflows', [
      'workflow_type',
      'organization_id',
    ]);

    this.registerHistogram(
      'workflow_completion_time_seconds',
      'Time to complete workflows in seconds',
      ['workflow_type'],
      [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400]
    );
  }

  getMetric(
    name: string
  ):
    | promClient.Counter<string>
    | promClient.Gauge<string>
    | promClient.Histogram<string>
    | undefined {
    return this.businessMetrics.get(name);
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
