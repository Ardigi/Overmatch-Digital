import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { Request, Response } from 'express';

interface BadRequestExceptionResponse {
  message: string | string[] | ValidationError[];
  error?: string;
  statusCode?: number;
}

interface ValidationErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error: string;
  validationErrors: {
    field: string;
    constraints: string[];
    value?: any;
    children?: any[];
  }[];
}

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse() as BadRequestExceptionResponse;

    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      // This is a validation error from class-validator
      const validationErrors = this.formatValidationErrors(exceptionResponse.message);

      const errorResponse: ValidationErrorResponse = {
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: 'Validation failed',
        error: 'Bad Request',
        validationErrors,
      };

      response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
    } else {
      // Not a validation error, let it pass through
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: exceptionResponse.message || exception.message,
        error: exceptionResponse.error || 'Bad Request',
      });
    }
  }

  private formatValidationErrors(errors: any[]): any[] {
    return errors.map((error) => {
      if (typeof error === 'string') {
        return {
          field: 'unknown',
          constraints: [error],
        };
      }

      return this.formatError(error);
    });
  }

  private formatError(error: ValidationError): any {
    const formatted: any = {
      field: error.property,
      constraints: error.constraints ? Object.values(error.constraints) : [],
    };

    // Include the invalid value in development
    if (process.env.NODE_ENV === 'development') {
      formatted.value = error.value;
    }

    // Handle nested validation errors
    if (error.children && error.children.length > 0) {
      formatted.children = error.children.map((child) => this.formatError(child));
    }

    return formatted;
  }
}
