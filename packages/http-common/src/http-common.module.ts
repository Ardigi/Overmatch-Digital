import { HttpModule } from '@nestjs/axios';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextInterceptor, GlobalContextInterceptor } from './context/context.interceptor';
import { ContextMiddleware } from './context/context.middleware';
import { RequestContextService } from './context/request-context.service';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import {
  ConfigurableResponseInterceptor,
  ResponseInterceptor,
} from './interceptors/response.interceptor';
import type { HttpClientOptions } from './interfaces/service-config.interface';
import {
  PaginationTransformPipe,
  PaginationValidationPipe,
} from './pipes/pagination-validation.pipe';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HttpClientService } from './services/http-client.service';
import { ServiceDiscoveryService } from './services/service-discovery.service';
import { PaginationUtil } from './utils/pagination.util';
import { ResponseBuilder } from './utils/response-builder';

export interface HttpCommonModuleOptions {
  global?: boolean;
  imports?: any[];
  defaultTimeout?: number;
  defaultRetries?: number;
  enableLogging?: boolean;
  enableCorrelationId?: boolean;
  enableResponseInterceptor?: boolean;
  enableRequestContext?: boolean;
  enableContextInterceptor?: boolean;
  serviceName?: string;
  serviceVersion?: string;
  responseInterceptorConfig?: {
    enableLogging?: boolean;
    enableTiming?: boolean;
    enableCorrelationId?: boolean;
    productionErrorMode?: boolean;
  };
  contextOptions?: {
    includeUserContext?: boolean;
    includeAuditContext?: boolean;
    includeRequestMetadata?: boolean;
  };
}

@Global()
@Module({})
export class HttpCommonModule {
  static forRoot(options: HttpCommonModuleOptions = {}): DynamicModule {
    const {
      global = true,
      imports = [],
      defaultTimeout = 30000,
      defaultRetries = 3,
      enableLogging = true,
      enableCorrelationId = true,
      enableResponseInterceptor = true,
      enableRequestContext = true,
      enableContextInterceptor = true,
      serviceName,
      serviceVersion,
      responseInterceptorConfig = {},
      contextOptions = {},
    } = options;

    const providers: any[] = [
      HttpClientService,
      ServiceDiscoveryService,
      CircuitBreakerService,
      ResponseBuilder,
      PaginationUtil,
      {
        provide: PaginationValidationPipe,
        useValue: new PaginationValidationPipe(),
      },
      {
        provide: PaginationTransformPipe,
        useValue: new PaginationTransformPipe(),
      },
    ];

    // Add context services if enabled
    if (enableRequestContext) {
      providers.push(RequestContextService);
      providers.push(ContextMiddleware);
    }

    // Add context interceptor if enabled
    if (enableContextInterceptor && enableRequestContext) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: (contextService: RequestContextService) =>
          new GlobalContextInterceptor(contextService),
        inject: [RequestContextService],
      });
    }

    if (enableLogging) {
      providers.push(LoggingInterceptor);
    }

    if (enableCorrelationId) {
      providers.push(CorrelationIdInterceptor);
    }

    if (enableResponseInterceptor) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: () =>
          new ConfigurableResponseInterceptor({
            serviceName,
            serviceVersion,
            ...responseInterceptorConfig,
          }),
      });
    }

    return {
      module: HttpCommonModule,
      global,
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule.register({
          timeout: defaultTimeout,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'SOC-Compliance-Platform/1.0',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }),
        ...imports,
      ],
      providers,
      exports: [
        HttpClientService,
        ServiceDiscoveryService,
        CircuitBreakerService,
        ResponseBuilder,
        PaginationUtil,
        PaginationValidationPipe,
        PaginationTransformPipe,
        HttpModule,
        // Export context services if enabled
        ...(enableRequestContext ? [RequestContextService, ContextMiddleware] : []),
      ],
    };
  }

  static forFeature(options: HttpClientOptions = {}): DynamicModule {
    return {
      module: HttpCommonModule,
      imports: [
        HttpModule.register({
          baseURL: options.baseURL,
          timeout: options.timeout || 30000,
          headers: options.headers || {},
          maxRedirects: 5,
        }),
      ],
      providers: [
        HttpClientService,
        ServiceDiscoveryService,
        CircuitBreakerService,
        ResponseBuilder,
        PaginationUtil,
        {
          provide: PaginationValidationPipe,
          useValue: new PaginationValidationPipe(),
        },
        {
          provide: PaginationTransformPipe,
          useValue: new PaginationTransformPipe(),
        },
        // Always include context service for feature modules
        RequestContextService,
        ContextMiddleware,
      ],
      exports: [
        HttpClientService,
        ServiceDiscoveryService,
        ResponseBuilder,
        PaginationUtil,
        HttpModule,
        RequestContextService,
        ContextMiddleware,
      ],
    };
  }
}

/**
 * Standalone response utilities that don't require module import
 */
export class HttpCommonStandalone {
  /**
   * Create a basic response interceptor without DI
   */
  static createResponseInterceptor(serviceName?: string, serviceVersion?: string) {
    return new ResponseInterceptor(serviceName, serviceVersion);
  }

  /**
   * Create a configurable response interceptor without DI
   */
  static createConfigurableResponseInterceptor(options: any = {}) {
    return new ConfigurableResponseInterceptor(options);
  }

  /**
   * Get the ResponseBuilder utility
   */
  static get ResponseBuilder() {
    return ResponseBuilder;
  }

  /**
   * Get the PaginationUtil utility
   */
  static get PaginationUtil() {
    return PaginationUtil;
  }
}
