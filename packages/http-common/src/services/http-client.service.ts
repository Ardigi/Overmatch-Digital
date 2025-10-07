import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ServiceApiKeysConfig } from '@soc-compliance/auth-common';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';
import type { ServiceError, ServiceResponse } from '../interfaces/http-response.interface';
import type { ContextOptions } from '../interfaces/request-context.interface';
import { 
  HttpClientOptions, 
  type HttpRequestConfig,
  type ServiceConfig 
} from '../interfaces/service-config.interface';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly circuitBreaker: CircuitBreakerService,
    @Optional() private readonly contextService?: RequestContextService,
  ) {
    // Configure axios retry
    axiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ? error.response.status >= 500 : false);
      },
    });
  }

  async get<T>(
    url: string,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    return this.request<T>('GET', url, undefined, config, serviceConfig, contextOptions);
  }

  async post<T>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    return this.request<T>('POST', url, data, config, serviceConfig, contextOptions);
  }

  async put<T>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    return this.request<T>('PUT', url, data, config, serviceConfig, contextOptions);
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    return this.request<T>('PATCH', url, data, config, serviceConfig, contextOptions);
  }

  async delete<T>(
    url: string,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    return this.request<T>('DELETE', url, undefined, config, serviceConfig, contextOptions);
  }

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
    contextOptions?: ContextOptions,
  ): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Get context propagation headers
      const contextHeaders = this.getContextHeaders(serviceConfig?.name, contextOptions);
      
      const axiosConfig: AxiosRequestConfig = {
        method,
        url,
        data,
        params: config?.params,
        headers: {
          'X-Request-ID': requestId,
          'X-Service-Name': process.env.SERVICE_NAME || 'unknown',
          ...contextHeaders,
          ...config?.headers, // User headers take precedence
        },
        timeout: config?.timeout || serviceConfig?.timeout || 30000,
      };

      // Add authentication
      if (config?.auth) {
        switch (config.auth.type) {
          case 'jwt':
            axiosConfig.headers!['Authorization'] = `Bearer ${config.auth.token}`;
            break;
          case 'api-key':
            axiosConfig.headers!['X-API-Key'] = config.auth.token!;
            break;
          case 'service': {
            // For service-to-service calls, use service API key or token
            const currentServiceName = process.env.SERVICE_NAME;
            if (currentServiceName) {
              // Try to get API key from configuration
              const serviceApiKey = this.getServiceApiKey(currentServiceName);
              if (serviceApiKey) {
                axiosConfig.headers!['X-Service-API-Key'] = serviceApiKey;
              } else if (config.auth.token) {
                axiosConfig.headers!['X-Service-Token'] = config.auth.token;
              }
            } else if (config.auth.token) {
              axiosConfig.headers!['X-Service-Token'] = config.auth.token;
            }
            break;
          }
        }
      } else if (serviceConfig) {
        // Default to service authentication for inter-service calls
        const currentServiceName = process.env.SERVICE_NAME;
        if (currentServiceName) {
          const serviceApiKey = this.getServiceApiKey(currentServiceName);
          if (serviceApiKey) {
            axiosConfig.headers!['X-Service-API-Key'] = serviceApiKey;
          }
        }
      }

      let response: AxiosResponse<T>;

      if (serviceConfig?.circuitBreaker) {
        // Execute with circuit breaker
        response = await this.circuitBreaker.executeWithCircuitBreaker(
          serviceConfig.name,
          serviceConfig.circuitBreaker,
          async () => {
            return await firstValueFrom(
              this.httpService.request<T>(axiosConfig).pipe(
                catchError((error) => {
                  this.logger.error(`HTTP request failed: ${error.message}`, {
                    url,
                    method,
                    requestId,
                    error: error.response?.data || error.message,
                  });
                  return throwError(() => error);
                }),
              ),
            );
          },
        );
      } else {
        // Execute without circuit breaker
        response = await firstValueFrom(
          this.httpService.request<T>(axiosConfig).pipe(
            catchError((error) => {
              this.logger.error(`HTTP request failed: ${error.message}`, {
                url,
                method,
                requestId,
                error: error.response?.data || error.message,
              });
              return throwError(() => error);
            }),
          ),
        );
      }

      const duration = Date.now() - startTime;

      const correlationId = this.contextService?.getCorrelationId();
      this.logger.debug(`HTTP ${method} ${url} completed in ${duration}ms`, {
        requestId,
        correlationId,
        status: response.status,
        targetService: serviceConfig?.name,
      });

      return {
        success: true,
        data: response.data,
        metadata: {
          requestId,
          duration,
          service: serviceConfig?.name,
          correlationId: this.contextService?.getCorrelationId(),
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      const serviceError: ServiceError = {
        code: error.response?.status?.toString() || 'NETWORK_ERROR',
        message: error.response?.data?.message || error.message,
        details: error.response?.data || undefined,
        timestamp: new Date(),
        service: serviceConfig?.name,
      };

      const correlationId = this.contextService?.getCorrelationId();
      this.logger.error(`HTTP request failed after ${duration}ms`, {
        url,
        method,
        requestId,
        correlationId,
        targetService: serviceConfig?.name,
        error: serviceError,
      });

      return {
        success: false,
        error: serviceError,
        metadata: {
          requestId,
          duration,
          service: serviceConfig?.name,
          correlationId: this.contextService?.getCorrelationId(),
        },
      };
    }
  }

  /**
   * Get context propagation headers from current request context
   */
  private getContextHeaders(targetService?: string, options?: ContextOptions): Record<string, string> {
    if (!this.contextService) {
      return {};
    }

    try {
      const context = this.contextService.getCurrentContext();
      if (!context) {
        return {};
      }

      // Create child context for the outgoing request
      const childContext = this.contextService.createChildContext(targetService);
      
      // Convert context to headers with options
      const headers = this.contextService.contextToHeaders(childContext, options);
      
      // Convert header object to string values (axios expects string headers)
      const stringHeaders: Record<string, string> = {};
      Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined) {
          stringHeaders[key] = String(value);
        }
      });

      this.logger.debug('Adding context headers to outgoing request', {
        correlationId: childContext.correlationId,
        targetService,
        headerKeys: Object.keys(stringHeaders),
      });

      return stringHeaders;
    } catch (error) {
      this.logger.warn('Failed to get context headers', {
        error: error instanceof Error ? error.message : String(error),
        targetService,
      });
      return {};
    }
  }

  /**
   * Make a request with explicit context (useful for background jobs)
   */
  async requestWithContext<T>(
    method: string,
    url: string,
    contextHeaders: Record<string, string>,
    data?: any,
    config?: HttpRequestConfig,
    serviceConfig?: ServiceConfig,
  ): Promise<ServiceResponse<T>> {
    const enhancedConfig: HttpRequestConfig = {
      ...config,
      headers: {
        ...contextHeaders,
        ...config?.headers,
      },
    };

    return this.request<T>(method, url, data, enhancedConfig, serviceConfig);
  }

  /**
   * Create headers from a correlation ID (minimal context propagation)
   */
  createMinimalContextHeaders(correlationId: string, sourceService?: string): Record<string, string> {
    return {
      'x-correlation-id': correlationId,
      'x-source-service': sourceService || process.env.SERVICE_NAME || 'unknown',
    };
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service API key using centralized configuration
   */
  private getServiceApiKey(serviceName: string): string | undefined {
    // Use centralized ServiceApiKeysConfig for API key management
    const apiKey = ServiceApiKeysConfig.getApiKey(serviceName);
    
    if (apiKey) {
      if (ServiceApiKeysConfig.isUsingDefault(serviceName)) {
        this.logger.debug(`Using default API key for ${serviceName} in development`);
      }
      return apiKey;
    }

    this.logger.warn(`No API key found for service: ${serviceName}`);
    return undefined;
  }
}