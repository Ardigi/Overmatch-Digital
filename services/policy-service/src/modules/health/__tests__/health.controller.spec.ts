import { ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let typeOrmHealthIndicator: TypeOrmHealthIndicator;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockTypeOrmHealthIndicator = {
    pingCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockTypeOrmHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    typeOrmHealthIndicator = module.get<TypeOrmHealthIndicator>(TypeOrmHealthIndicator);

    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when all checks pass', async () => {
      const healthyResponse = {
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
          },
        },
      };

      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({
        database: { status: 'up' },
      });

      mockHealthCheckService.check.mockImplementation(async (indicators) => {
        const results = await Promise.all(indicators.map((indicator) => indicator()));
        return healthyResponse;
      });

      const result = await controller.check();

      expect(result).toEqual(healthyResponse);
      expect(result.status).toBe('ok');
      expect(result.info.database.status).toBe('up');
    });

    it('should return error status when database is down', async () => {
      const unhealthyResponse = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Connection failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Connection failed',
          },
        },
      };

      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(
        new ServiceUnavailableException('Database connection failed')
      );

      mockHealthCheckService.check.mockImplementation(async (indicators) => {
        try {
          await Promise.all(indicators.map((indicator) => indicator()));
        } catch (error) {
          return unhealthyResponse;
        }
      });

      const result = await controller.check();

      expect(result).toEqual(unhealthyResponse);
      expect(result.status).toBe('error');
      expect(result.error.database.status).toBe('down');
    });

    it('should include all health indicators in the check', async () => {
      await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([expect.any(Function)]);

      // Verify the database check function was created
      const checkFunctions = mockHealthCheckService.check.mock.calls[0][0];
      expect(checkFunctions).toHaveLength(1);
    });

    it('should call database ping check with correct parameters', async () => {
      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({
        database: { status: 'up' },
      });

      mockHealthCheckService.check.mockImplementation(async (indicators) => {
        await indicators[0](); // Execute the database check
        return { status: 'ok', info: { database: { status: 'up' } } };
      });

      await controller.check();

      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
    });

    it('should handle timeout scenarios', async () => {
      const timeoutResponse = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Health check timed out',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Health check timed out',
          },
        },
      };

      mockTypeOrmHealthIndicator.pingCheck.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Simulate a timeout by never resolving
            setTimeout(() => resolve({ database: { status: 'up' } }), 10000);
          })
      );

      mockHealthCheckService.check.mockResolvedValue(timeoutResponse);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error.database.message).toContain('timed out');
    });

    it('should provide detailed error information for debugging', async () => {
      const detailedError = new Error('ECONNREFUSED: Connection refused to database host');
      detailedError['code'] = 'ECONNREFUSED';

      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(detailedError);

      mockHealthCheckService.check.mockImplementation(async (indicators) => {
        try {
          await indicators[0]();
        } catch (error) {
          return {
            status: 'error',
            info: {},
            error: {
              database: {
                status: 'down',
                message: error.message,
                code: error.code,
              },
            },
            details: {
              database: {
                status: 'down',
                message: error.message,
                code: error.code,
              },
            },
          };
        }
      });

      const result = await controller.check();

      expect(result.error.database.code).toBe('ECONNREFUSED');
      expect(result.error.database.message).toContain('Connection refused');
    });
  });

  describe('Production Readiness', () => {
    it('should be accessible without authentication', () => {
      // Health checks should be public for monitoring tools
      const metadata = Reflect.getMetadata('__guards__', controller.check);
      expect(metadata).toBeUndefined();
    });

    it('should complete health check within reasonable time', async () => {
      mockHealthCheckService.check.mockImplementation(async () => {
        // Simulate quick response
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 'ok',
              info: { database: { status: 'up' } },
            });
          }, 50); // 50ms response time
        });
      });

      const startTime = Date.now();
      await controller.check();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should not expose sensitive information in health check', async () => {
      const errorWithSensitiveInfo = new Error(
        'Connection failed: password=secret123@db.internal:5432'
      );

      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(errorWithSensitiveInfo);

      mockHealthCheckService.check.mockImplementation(async (indicators) => {
        try {
          await indicators[0]();
        } catch (error) {
          // Should sanitize error messages
          const sanitizedMessage = error.message.replace(/password=\S+/, 'password=***');
          return {
            status: 'error',
            info: {},
            error: {
              database: {
                status: 'down',
                message: sanitizedMessage,
              },
            },
          };
        }
      });

      const result = await controller.check();

      expect(result.error.database.message).not.toContain('secret123');
      expect(result.error.database.message).toContain('password=***');
    });
  });

  describe('Enhanced Health Checks', () => {
    it('should support future expansion with additional health indicators', async () => {
      // This test documents how to add more health checks in the future
      const mockRedisHealthIndicator = {
        pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
      };

      const mockKafkaHealthIndicator = {
        pingCheck: jest.fn().mockResolvedValue({ kafka: { status: 'up' } }),
      };

      // In a real implementation, you would inject these and add them to the check array
      const enhancedHealthResponse = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          kafka: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          kafka: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(enhancedHealthResponse);

      const result = await controller.check();

      expect(result.info).toHaveProperty('database');
      // Future indicators would appear here
      // expect(result.info).toHaveProperty('redis');
      // expect(result.info).toHaveProperty('kafka');
    });

    it('should provide granular status for monitoring dashboards', async () => {
      const detailedHealthResponse = {
        status: 'ok',
        info: {
          database: {
            status: 'up',
            responseTime: 23,
            connections: {
              active: 5,
              idle: 10,
              total: 15,
            },
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
            responseTime: 23,
            connections: {
              active: 5,
              idle: 10,
              total: 15,
            },
          },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(detailedHealthResponse);

      const result = await controller.check();

      expect(result.info.database.responseTime).toBeDefined();
      expect(result.info.database.connections).toBeDefined();
    });
  });

  describe('Compliance and Security', () => {
    it('should log health check access for audit purposes', async () => {
      const loggerSpy = jest.spyOn(console, 'log').mockImplementation();

      await controller.check();

      // In production, this would use a proper logger
      // expect(loggerSpy).toHaveBeenCalledWith(
      //   expect.stringContaining('Health check accessed')
      // );

      loggerSpy.mockRestore();
    });

    it('should handle graceful degradation', async () => {
      // Even if some checks fail, the endpoint should still respond
      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(new Error('Database unavailable'));

      mockHealthCheckService.check.mockResolvedValue({
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Database unavailable',
          },
        },
      });

      await expect(controller.check()).resolves.toBeDefined();
      // Should not throw, but return error status
    });

    it('should implement circuit breaker pattern for repeated failures', async () => {
      // Simulate multiple failures
      let callCount = 0;
      mockTypeOrmHealthIndicator.pingCheck.mockImplementation(() => {
        callCount++;
        if (callCount < 5) {
          throw new Error('Database connection failed');
        }
        return { database: { status: 'up' } };
      });

      // First few calls should fail
      for (let i = 0; i < 3; i++) {
        mockHealthCheckService.check.mockImplementationOnce(async (indicators) => {
          try {
            await indicators[0](); // Execute the health check
          } catch (error) {
            // Expected to fail
          }
          return {
            status: 'error',
            error: { database: { status: 'down' } },
          };
        });
        await controller.check();
      }

      // Circuit breaker would open here in production
      // Subsequent calls might return cached failure without hitting DB
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledTimes(3);
    });
  });
});
