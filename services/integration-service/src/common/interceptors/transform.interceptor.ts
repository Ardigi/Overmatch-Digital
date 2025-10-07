import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response is already formatted (e.g., from a specific endpoint)
        if (data && typeof data === 'object' && 'data' in data) {
          return data;
        }

        // Handle pagination responses
        if (data && typeof data === 'object' && 'items' in data && 'total' in data) {
          return {
            data: instanceToPlain(data.items) as T,
            meta: {
              timestamp: new Date().toISOString(),
              version: '1.0',
              pagination: {
                total: data.total,
                page: data.page || 1,
                limit: data.limit || 20,
                totalPages: Math.ceil(data.total / (data.limit || 20)),
              },
            },
          };
        }

        // Standard response format
        return {
          data: instanceToPlain(data) as T,
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        };
      })
    );
  }
}
