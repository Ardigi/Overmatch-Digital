import { Injectable } from '@nestjs/common';
import {
  type Context,
  context,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { TracingConfig } from './interfaces';

@Injectable()
export class TracingService {
  private sdk: NodeSDK | undefined;
  private readonly tracer: any;

  constructor(private readonly config: TracingConfig) {
    if (config.enabled !== false) {
      this.initializeTracing();
    }
    this.tracer = trace.getTracer(config.serviceName);
  }

  private initializeTracing(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    const traceExporter = new OTLPTraceExporter({
      url: this.config.endpoint || 'http://localhost:4317',
      headers: this.config.headers,
    });

    const metricExporter = new OTLPMetricExporter({
      url: this.config.endpoint || 'http://localhost:4317',
      headers: this.config.headers,
    });

    this.sdk = new NodeSDK({
      resource,
      spanProcessors: [new BatchSpanProcessor(traceExporter) as any],
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000,
      }) as any,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            requestHook: (span, request) => {
              // Only access body if it exists and is serializable
              if ((request as any).body && typeof (request as any).body === 'object') {
                try {
                  span.setAttribute('http.request.body', JSON.stringify((request as any).body));
                } catch {
                  span.setAttribute('http.request.body', '[non-serializable]');
                }
              }
            },
            responseHook: (span, response) => {
              // Safely access headers
              const headers = (response as any).headers || {};
              const contentLength = headers['content-length'] || '0';
              span.setAttribute('http.response.size', parseInt(contentLength, 10) || 0);
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-mongodb': {
            enabled: true,
          },
        }),
      ],
    });

    this.sdk.start();
  }

  createSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
      parent?: Context;
    }
  ): Span {
    const span = this.tracer.startSpan(
      name,
      {
        kind: options?.kind || SpanKind.INTERNAL,
        attributes: options?.attributes,
      },
      options?.parent
    );

    return span;
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
    }
  ): Promise<T> {
    const span = this.createSpan(name, options);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await fn(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }

  getCurrentSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }

  setSpanAttribute(key: string, value: any): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  setSpanStatus(code: SpanStatusCode, message?: string): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setStatus({ code, message });
    }
  }

  recordException(error: Error, attributes?: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.recordException(error);
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
    }
  }

  getTraceId(): string | undefined {
    const span = this.getCurrentSpan();
    return span?.spanContext().traceId;
  }

  getSpanId(): string | undefined {
    const span = this.getCurrentSpan();
    return span?.spanContext().spanId;
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}
