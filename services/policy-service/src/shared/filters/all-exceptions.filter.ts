import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MongoError } from 'mongodb';
import { QueryFailedError } from 'typeorm';
import type { MongoKeyPattern } from '../../modules/shared/types';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  details?: any;
  correlationId?: string;
  stack?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
          error?: string;
          details?: any;
        };
        message = responseObj.message || exception.message;
        error = responseObj.error || error;
        details = responseObj.details;
      }
    } else if (exception instanceof QueryFailedError) {
      // TypeORM query errors
      status = HttpStatus.BAD_REQUEST;
      error = 'Database Query Error';
      message = this.sanitizeDatabaseError(exception);
      const dbError = exception as QueryFailedError & {
        code?: string;
        detail?: string;
        table?: string;
        constraint?: string;
      };
      details = {
        code: dbError.code,
        detail: dbError.detail,
        table: dbError.table,
        constraint: dbError.constraint,
      };
    } else if (exception instanceof MongoError) {
      // MongoDB errors
      status = HttpStatus.BAD_REQUEST;
      error = 'MongoDB Error';
      message = this.sanitizeMongoError(exception);
      const mongoErr = exception as MongoError & { codeName?: string };
      details = {
        code: mongoErr.code,
        codeName: mongoErr.codeName,
      };
    } else if (
      exception &&
      typeof exception === 'object' &&
      'name' in exception &&
      (exception.constructor?.name === 'ElasticsearchClientError' ||
        exception.name === 'ElasticsearchClientError')
    ) {
      // Elasticsearch errors
      status = HttpStatus.BAD_REQUEST;
      error = 'Search Error';
      message = 'Search operation failed';
      const esError = exception as { name?: string; statusCode?: number };
      details = {
        type: esError.name || 'UnknownError',
        statusCode: esError.statusCode,
      };
    } else if (exception instanceof Error) {
      // Generic errors
      message = exception.message;

      // Check for specific error patterns
      if (message.includes('Unauthorized')) {
        status = HttpStatus.UNAUTHORIZED;
        error = 'Unauthorized';
      } else if (message.includes('Forbidden')) {
        status = HttpStatus.FORBIDDEN;
        error = 'Forbidden';
      } else if (message.includes('Not Found')) {
        status = HttpStatus.NOT_FOUND;
        error = 'Not Found';
      } else if (message.includes('Conflict')) {
        status = HttpStatus.CONFLICT;
        error = 'Conflict';
      } else if (message.includes('Validation')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'Validation Error';
      }
    }

    // Log the error
    this.logError(exception, request, correlationId);

    // Build response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      correlationId,
    };

    // Add details in non-production environments
    if (process.env.NODE_ENV !== 'production' && details) {
      errorResponse.details = details;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    // Send response
    response.status(status).header('X-Correlation-ID', correlationId).json(errorResponse);
  }

  private sanitizeDatabaseError(error: QueryFailedError): string {
    const message = error.message;

    // Handle common database errors
    if (message.includes('duplicate key')) {
      const match = message.match(/Key \((.*?)\)=/);
      const field = match ? match[1] : 'field';
      return `A record with this ${field} already exists`;
    }

    if (message.includes('foreign key constraint')) {
      return 'Referenced record does not exist or cannot be deleted due to existing references';
    }

    if (message.includes('not-null constraint')) {
      const match = message.match(/column "(.*?)"/);
      const field = match ? match[1] : 'field';
      return `The ${field} field is required`;
    }

    if (message.includes('check constraint')) {
      return 'Invalid value provided for one or more fields';
    }

    // Generic database error
    return 'Database operation failed';
  }

  private sanitizeMongoError(error: MongoError): string {
    if (error.code === 11000) {
      // Duplicate key error
      const mongoErr = error as MongoError & { keyPattern?: MongoKeyPattern };
      const keyPattern = mongoErr.keyPattern;
      const field = keyPattern ? Object.keys(keyPattern)[0] : 'field';
      return `A document with this ${field} already exists`;
    }

    if (error.code === 121) {
      return 'Document validation failed';
    }

    return 'Database operation failed';
  }

  private logError(exception: unknown, request: Request, correlationId: string): void {
    const user = (request as Request & { user?: { id?: string; organizationId?: string } }).user;

    const errorLog = {
      correlationId,
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: user?.id,
      organizationId: user?.organizationId,
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : exception,
    };

    // Log with appropriate level
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error('Server error occurred', errorLog);
      } else if (status >= 400) {
        this.logger.warn('Client error occurred', errorLog);
      }
    } else {
      this.logger.error('Unhandled exception occurred', errorLog);
    }
  }
}
