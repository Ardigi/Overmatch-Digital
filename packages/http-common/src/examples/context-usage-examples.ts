/**
 * Examples showing how to use the request context propagation system
 */

import { Body, Controller, Get, Injectable, type NestMiddleware, Post } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  ContextInterceptor,
  ContextMiddleware,
  createContextMiddleware,
  HttpClientService,
  RequestContextService,
} from '../index';
import { AuditContext, RequestContext, UserContext } from '../interfaces/request-context.interface';

// =============================================================================
// 1. BASIC SETUP IN APP MODULE
// =============================================================================

/**
 * Example of setting up request context in your main application module
 */
/*
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpCommonModule, RequestContextService, ContextMiddleware, GlobalContextInterceptor } from '@soc-compliance/http-common';

@Module({
  imports: [
    HttpCommonModule.forRoot({
      enableRequestContext: true,
      enableContextInterceptor: true,
      contextOptions: {
        includeUserContext: true,
        includeAuditContext: true,
        includeRequestMetadata: true,
      },
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply context middleware to all routes
    consumer
      .apply(ContextMiddleware)
      .forRoutes('*');
  }
}
*/

// =============================================================================
// 2. ALTERNATIVE SETUP WITH FUNCTIONAL MIDDLEWARE
// =============================================================================

/**
 * Example using functional middleware in main.ts
 */
/*
import { NestFactory } from '@nestjs/core';
import { RequestContextService, createContextMiddleware } from '@soc-compliance/http-common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get context service from DI container
  const contextService = app.get(RequestContextService);
  
  // Apply context middleware
  app.use(createContextMiddleware(contextService));
  
  await app.listen(3000);
}
bootstrap();
*/

// =============================================================================
// 3. SERVICE USAGE EXAMPLES
// =============================================================================

@Injectable()
class ExampleService {
  constructor(
    private readonly contextService: RequestContextService,
    private readonly httpClient: HttpClientService,
  ) {}

  /**
   * Example: Get current request context
   */
  async getCurrentUser() {
    const context = this.contextService.getCurrentContext();
    if (!context?.user) {
      throw new Error('No user context available');
    }
    
    return {
      userId: context.user.userId,
      organizationId: context.user.organizationId,
      roles: context.user.roles,
    };
  }

  /**
   * Example: Log current context for debugging
   */
  debugContext() {
    this.contextService.logContext('Debug: Current request context');
  }

  /**
   * Example: Store custom data in context
   */
  async processOrder(orderId: string) {
    // Store order ID for later use in the request
    this.contextService.setCustomData('orderId', orderId);
    
    // Update audit context with specific action
    this.contextService.updateContext({
      audit: {
        action: 'process_order',
        resource: 'orders',
        timestamp: new Date(),
        metadata: { orderId },
      },
    });

    // Make HTTP call - context automatically propagated
    return this.httpClient.post('/payment-service/orders', { orderId });
  }

  /**
   * Example: HTTP calls with automatic context propagation
   */
  async getUserProfile(userId: string) {
    // Context headers automatically added to outgoing request
    const response = await this.httpClient.get(
      `/user-service/users/${userId}`,
      undefined, // config
      { name: 'user-service', url: 'http://user-service:3001', timeout: 5000 }, // service config
      { includeUser: true } // context options
    );

    return response.data;
  }

  /**
   * Example: Making requests with specific context options
   */
  async exportData() {
    // Include audit context but exclude user details for security
    const response = await this.httpClient.post(
      '/reporting-service/exports',
      { format: 'csv' },
      undefined, // config
      { name: 'reporting-service', url: 'http://reporting-service:3007' }, // service config
      { 
        includeUser: false, // Don't propagate user details
        includeAudit: true,  // But include audit info
        includeMetadata: true,
        customHeaders: { 'x-export-type': 'csv' }
      }
    );

    return response.data;
  }

  /**
   * Example: Background job with manual context
   */
  async processBackgroundJob(correlationId: string, userId: string, organizationId: string) {
    // Create minimal context headers for background processing
    const contextHeaders = this.httpClient.createMinimalContextHeaders(
      correlationId,
      'background-processor'
    );

    // Add user context manually
    contextHeaders['x-user-id'] = userId;
    contextHeaders['x-organization-id'] = organizationId;

    // Make request with explicit context
    const response = await this.httpClient.requestWithContext(
      'POST',
      '/workflow-service/jobs',
      contextHeaders,
      { type: 'background-process' }
    );

    return response.data;
  }
}

// =============================================================================
// 4. CONTROLLER USAGE EXAMPLES
// =============================================================================

@Controller('examples')
class ExampleController {
  constructor(
    private readonly contextService: RequestContextService,
    private readonly exampleService: ExampleService,
  ) {}

  /**
   * Example: Access context in controller
   */
  @Get('context')
  getContext() {
    const context = this.contextService.getCurrentContext();
    
    return {
      correlationId: context?.correlationId,
      user: context?.user ? {
        id: context.user.userId,
        organization: context.user.organizationId,
      } : null,
      audit: context?.audit ? {
        action: context.audit.action,
        resource: context.audit.resource,
      } : null,
    };
  }

  /**
   * Example: Update context in controller
   */
  @Post('orders')
  async createOrder(@Body() orderData: any) {
    // Update audit context with specific action
    this.contextService.updateContext({
      audit: {
        action: 'create_order',
        resource: 'orders',
        timestamp: new Date(),
        metadata: orderData,
      },
    });

    // Process order - context will be propagated to all service calls
    return this.exampleService.processOrder(orderData.id);
  }
}

// =============================================================================
// 5. CUSTOM MIDDLEWARE EXAMPLES
// =============================================================================

/**
 * Example: Custom middleware that enhances context
 */
@Injectable()
class CustomContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Add custom context data based on request
    const context = this.contextService.getCurrentContext();
    if (context) {
      // Add custom metadata
      this.contextService.setCustomData('requestPath', req.path);
      this.contextService.setCustomData('requestMethod', req.method);
      
      // Add tenant information if available
      const tenantId = req.headers['x-tenant-id'] as string;
      if (tenantId) {
        this.contextService.setCustomData('tenantId', tenantId);
      }
    }

    next();
  }
}

// =============================================================================
// 6. TESTING EXAMPLES
// =============================================================================

/**
 * Example: Testing with request context
 */
/*
describe('ExampleService', () => {
  let service: ExampleService;
  let contextService: RequestContextService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExampleService,
        RequestContextService,
        {
          provide: HttpClientService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExampleService>(ExampleService);
    contextService = module.get<RequestContextService>(RequestContextService);
  });

  it('should process order with context', async () => {
    // Create test context
    const testContext: RequestContext = {
      correlationId: 'test-correlation-id',
      user: {
        userId: 'user-123',
        organizationId: 'org-456',
        roles: ['user'],
      },
      audit: {
        action: 'test',
        resource: 'orders',
        timestamp: new Date(),
      },
      request: {
        sourceService: 'test-service',
        method: 'POST',
        path: '/test',
        startTime: new Date(),
      },
    };

    // Run test in context
    await contextService.runWithContext(testContext, async () => {
      const result = await service.processOrder('order-123');
      
      // Verify context was used
      expect(contextService.getCorrelationId()).toBe('test-correlation-id');
      expect(contextService.getCustomData('orderId')).toBe('order-123');
    });
  });
});
*/

// =============================================================================
// 7. ADVANCED USAGE PATTERNS
// =============================================================================

@Injectable()
class AdvancedContextService {
  constructor(private readonly contextService: RequestContextService) {}

  /**
   * Example: Context-aware logging
   */
  logWithContext(message: string, data?: any) {
    const context = this.contextService.getCurrentContext();
    console.log({
      message,
      data,
      correlationId: context?.correlationId,
      userId: context?.user?.userId,
      organizationId: context?.user?.organizationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Example: Multi-tenant data filtering
   */
  async getFilteredData(query: any) {
    const context = this.contextService.getCurrentContext();
    const organizationId = context?.user?.organizationId;
    
    if (!organizationId) {
      throw new Error('No organization context available');
    }

    // Add organization filter to all queries
    return {
      ...query,
      organizationId,
    };
  }

  /**
   * Example: Role-based feature toggling
   */
  canAccessFeature(feature: string): boolean {
    const context = this.contextService.getCurrentContext();
    const userRoles = context?.user?.roles || [];
    
    const featureRoles: Record<string, string[]> = {
      'advanced-reporting': ['admin', 'analyst'],
      'user-management': ['admin'],
      'export-data': ['admin', 'analyst', 'viewer'],
    };

    const requiredRoles = featureRoles[feature] || [];
    return requiredRoles.some(role => userRoles.includes(role));
  }

  /**
   * Example: Context inheritance for child operations
   */
  async performChildOperation(operationName: string) {
    const childContext = this.contextService.createChildContext(
      'child-service',
      'child_operation',
      operationName
    );

    // Child context inherits parent context but has updated metadata
    console.log('Child context:', {
      correlationId: childContext.correlationId, // Same as parent
      targetService: childContext.request.targetService, // 'child-service'
      auditAction: childContext.audit?.action, // 'child_operation'
    });

    return childContext;
  }
}

// These are example implementations for documentation purposes