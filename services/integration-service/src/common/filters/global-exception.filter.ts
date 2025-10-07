import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Check if the response has expected properties
        if ('message' in exceptionResponse && typeof exceptionResponse.message === 'string') {
          message = exceptionResponse.message;
        }
        if ('error' in exceptionResponse && typeof exceptionResponse.error === 'string') {
          error = exceptionResponse.error;
        }
        if ('details' in exceptionResponse) {
          details = exceptionResponse.details;
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database query failed';
      error = 'Bad Request';

      // Handle specific database errors
      // QueryFailedError may have driverError with code property
      if ('driverError' in exception && exception.driverError) {
        const driverError = exception.driverError;
        if ('code' in driverError) {
          if (driverError.code === '23505') {
            message = 'Duplicate entry found';
            if ('constraint' in driverError) {
              details = { constraint: driverError.constraint };
            }
          } else if (driverError.code === '23503') {
            message = 'Foreign key constraint violation';
            if ('constraint' in driverError) {
              details = { constraint: driverError.constraint };
            }
          }
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'development') {
        details = { stack: exception.stack };
      }
    }

    const errorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(details && { details }),
    };

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    // Log request body in development for debugging
    if (process.env.NODE_ENV === 'development' && request.body) {
      this.logger.debug(`Request body: ${JSON.stringify(request.body)}`);
    }

    response.status(status).json(errorResponse);
  }
}
