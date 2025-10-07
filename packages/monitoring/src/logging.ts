import { Injectable, type LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import type { LogContext, LoggingConfig } from './interfaces';
import './types';

@Injectable()
export class LoggingService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly config: LoggingConfig) {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.console !== false) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} [${config.serviceName}] ${level}: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // File transport
    if (config.file) {
      transports.push(
        new winston.transports.File({
          filename: config.file.filename,
          maxsize: config.file.maxSize ? parseInt(config.file.maxSize) : 5242880, // 5MB default
          maxFiles: config.file.maxFiles || 5,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
      );
    }

    // Elasticsearch transport
    if (config.elasticsearch) {
      transports.push(
        new ElasticsearchTransport({
          level: config.level || 'info',
          clientOpts: {
            node: config.elasticsearch.node,
          },
          index: config.elasticsearch.index || 'soc-logs',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }) as any // ElasticsearchTransport is compatible but types don't align perfectly
      );
    }

    this.logger = winston.createLogger({
      level: config.level || 'info',
      defaultMeta: {
        service: config.serviceName,
        environment: process.env.NODE_ENV || 'development',
        type: 'microservice',
      },
      transports,
    });
  }

  log(message: string, context?: LogContext): void {
    this.logger.info(message, this.enrichContext(context));
  }

  error(message: string, trace?: string, context?: LogContext): void {
    const errorContext = this.enrichContext(context);
    if (trace) {
      errorContext.stack = trace;
      errorContext.error = {
        message,
        stack: trace,
      };
    }
    this.logger.error(message, errorContext);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.enrichContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.enrichContext(context));
  }

  verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, this.enrichContext(context));
  }

  // Structured logging methods
  logHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.log('HTTP Request', {
      ...context,
      http: {
        method,
        path,
        statusCode,
        duration,
      },
    });
  }

  logDatabaseQuery(operation: string, table: string, duration: number, context?: LogContext): void {
    this.log('Database Query', {
      ...context,
      database: {
        operation,
        table,
        duration,
      },
    });
  }

  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    context?: LogContext
  ): void {
    this.log('Cache Operation', {
      ...context,
      cache: {
        operation,
        key,
      },
    });
  }

  logBusinessEvent(eventType: string, details: Record<string, any>, context?: LogContext): void {
    this.log('Business Event', {
      ...context,
      event: {
        type: eventType,
        details,
      },
    });
  }

  logSecurityEvent(eventType: string, details: Record<string, any>, context?: LogContext): void {
    this.warn('Security Event', {
      ...context,
      security: {
        type: eventType,
        details,
      },
      type: 'security_event',
    });
  }

  logComplianceEvent(
    framework: string,
    controlId: string,
    status: string,
    details: Record<string, any>,
    context?: LogContext
  ): void {
    this.log('Compliance Event', {
      ...context,
      compliance: {
        framework,
        controlId,
        status,
        details,
      },
      type: 'compliance_event',
    });
  }

  logAuditEvent(
    action: string,
    resource: string,
    userId: string,
    result: 'success' | 'failure',
    details?: Record<string, any>,
    context?: LogContext
  ): void {
    this.log('Audit Event', {
      ...context,
      audit: {
        action,
        resource,
        userId,
        result,
        details,
        timestamp: new Date().toISOString(),
      },
      type: 'audit_event',
    });
  }

  private enrichContext(context?: LogContext): Record<string, any> {
    const enriched: Record<string, any> = {
      timestamp: new Date().toISOString(),
      ...context,
    };

    // Add trace context if available
    if (context?.traceId || context?.spanId) {
      enriched.trace = {
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId,
      };
    }

    // Add user context if available
    if (context?.userId || context?.organizationId) {
      enriched.user = {
        id: context.userId,
        organizationId: context.organizationId,
      };
    }

    return enriched;
  }
}
