import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  [key: string]: any;
}

@Injectable()
export class ErrorHandlerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    next();
  }

  handleError(error: Error, req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string;

    // Log the error
    this.logger.error(`Error handling request: ${req.method} ${req.url}`, {
      error: error.message,
      statusCode: error instanceof HttpException ? error.getStatus() : 500,
      path: req.url,
      method: req.method,
      ip: req.ip,
      requestId,
    });

    // Set CORS headers for error responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'Internal Server Error';

    if (error instanceof HttpException) {
      statusCode = error.getStatus();
      const response = error.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        // Type-safe extraction of error response properties
        const errorResponse = response as HttpExceptionResponse;

        if (errorResponse.message !== undefined) {
          message = errorResponse.message;
        }

        if (errorResponse.error !== undefined && typeof errorResponse.error === 'string') {
          errorName = errorResponse.error;
        } else {
          errorName = error.name;
        }
      }
    } else if (
      error.name === 'SequelizeConnectionRefusedError' ||
      error.message.includes('ECONNREFUSED')
    ) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection error';
      errorName = 'Service Unavailable';
    } else if (error.name === 'ValidationError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      errorName = 'Bad Request';
    }

    // Sanitize sensitive information
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId,
    };

    res.status(statusCode).json(errorResponse);
  }
}
