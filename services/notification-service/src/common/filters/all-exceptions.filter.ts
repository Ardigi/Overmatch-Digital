import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

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
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as { message?: string | string[]; error?: string; details?: any };
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || exception.message;
        error = body.error || exception.name;
        details = body.details;
      } else {
        message = typeof responseBody === 'string' ? responseBody : exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;

      // Log the full error for debugging
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' &&
        exception instanceof Error && {
          stack: exception.stack,
        }),
    };

    this.logger.warn(`${request.method} ${request.url} ${status} - ${message}`);

    response.status(status).json(errorResponse);
  }
}
