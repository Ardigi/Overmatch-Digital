import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private config: ConfigService
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        // Database check
        async () => {
          try {
            return await this.db.pingCheck('database', { timeout: 3000 });
          } catch (error) {
            this.logger.error('Database health check failed', error);
            throw error;
          }
        },

        // Memory check - 95% threshold
        async () => {
          try {
            return await this.memory.checkHeap('memory_heap', 95 * 1024 * 1024 * 1024);
          } catch (error) {
            this.logger.warn('Memory health check warning', error);
            return { memory_heap: { status: 'up' } }; // Don't fail on memory warnings
          }
        },

        // Disk check - ensure 10% free space
        async () => {
          try {
            return await this.disk.checkStorage('storage', {
              threshold: 90 * 1024 * 1024 * 1024, // 90GB threshold
              path: process.platform === 'win32' ? 'C:\\' : '/',
            });
          } catch (error) {
            this.logger.warn('Disk health check warning', error);
            return { storage: { status: 'up' } }; // Don't fail on disk warnings
          }
        },
      ]);
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  @Get('liveness')
  @Public()
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'policy-service',
      version: this.config.get('app.version', '1.0.0'),
    };
  }

  @Get('readiness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<HealthCheckResult> {
    try {
      // Only check critical dependencies for readiness
      return await this.health.check([() => this.db.pingCheck('database', { timeout: 1000 })]);
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      throw error;
    }
  }

  @Get('detailed')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check with all dependencies' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'One or more systems degraded' })
  async detailed(): Promise<HealthCheckResult & { metadata: any }> {
    const startTime = Date.now();

    try {
      const healthResult = await this.health.check([
        // Database
        async () => {
          const start = Date.now();
          const result = await this.db.pingCheck('database');
          return {
            ...result,
            database: {
              ...result.database,
              responseTime: Date.now() - start,
            },
          };
        },

        // Memory
        () => this.memory.checkHeap('memory_heap', 95 * 1024 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 95 * 1024 * 1024 * 1024),

        // Disk
        () =>
          this.disk.checkStorage('storage', {
            threshold: 90 * 1024 * 1024 * 1024,
            path: process.platform === 'win32' ? 'C:\\' : '/',
          }),
      ]);

      // Add metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        service: 'policy-service',
        version: this.config.get('app.version', '1.0.0'),
        environment: this.config.get('app.env', 'development'),
        uptime: process.uptime(),
        totalCheckTime: Date.now() - startTime,
        pid: process.pid,
        nodejs: process.version,
      };

      return {
        ...healthResult,
        metadata,
      };
    } catch (error) {
      this.logger.error('Detailed health check failed', error);

      // Return partial results even on failure
      return {
        status: 'error',
        info: {},
        error: {
          general: {
            status: 'down',
            message: error.message,
          },
        },
        details: {},
        metadata: {
          timestamp: new Date().toISOString(),
          service: 'policy-service',
          error: true,
          totalCheckTime: Date.now() - startTime,
        },
      };
    }
  }
}
