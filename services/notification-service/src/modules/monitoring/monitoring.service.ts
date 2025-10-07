import { Injectable } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly metricsService: MetricsService) {}

  recordNotificationSent(channel: string, success: boolean): void {
    this.metricsService.incrementCounter('notifications_sent', {
      channel,
      status: success ? 'success' : 'failure',
    });
  }

  recordNotificationDelivery(channel: string, success: boolean, duration: number): void {
    this.metricsService.recordHistogram('notification_delivery_duration', duration, {
      channel,
      status: success ? 'delivered' : 'failed',
    });
  }

  recordTemplateUsage(templateCode: string, channel: string): void {
    this.metricsService.incrementCounter('template_usage', {
      template: templateCode,
      channel,
    });
  }

  recordRuleEvaluation(ruleId: string, matched: boolean, duration: number): void {
    this.metricsService.recordHistogram('rule_evaluation_duration', duration, {
      rule: ruleId,
      matched: matched.toString(),
    });
  }

  recordQueueDepth(channel: string, depth: number): void {
    this.metricsService.recordGauge('notification_queue_depth', depth, {
      channel,
    });
  }

  recordBatchProcessing(channel: string, batchSize: number, duration: number): void {
    this.metricsService.recordHistogram('batch_processing_duration', duration, {
      channel,
      batch_size: batchSize.toString(),
    });
  }

  recordWebhookDelivery(url: string, success: boolean, duration: number): void {
    this.metricsService.recordHistogram('webhook_delivery_duration', duration, {
      url,
      status: success ? 'success' : 'failure',
    });
  }

  recordEventProcessing(eventType: string, success: boolean, duration: number): void {
    this.metricsService.recordHistogram('event_processing_duration', duration, {
      event_type: eventType,
      status: success ? 'success' : 'failure',
    });
  }

  recordCacheHit(cacheKey: string, hit: boolean): void {
    this.metricsService.incrementCounter('cache_operations', {
      key: cacheKey,
      result: hit ? 'hit' : 'miss',
    });
  }

  recordApiLatency(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.metricsService.recordHistogram('api_latency', duration, {
      endpoint,
      method,
      status_code: statusCode.toString(),
    });
  }

  getMetrics(): any {
    return this.metricsService.getMetrics();
  }
}