import { InjectQueue } from '@nestjs/bull';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type DiskHealthIndicator,
  HealthCheck,
  type HealthCheckService,
  type MemoryHealthIndicator,
  type TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { Queue } from 'bull';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    @InjectQueue('workflow') private workflowQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database'),
      
      // Memory health - 300MB heap threshold
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      
      // Memory RSS - 512MB threshold
      () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024),
      
      // Disk health - 10% threshold
      () => this.disk.checkStorage('storage', {
        path: '/',
        thresholdPercent: 0.9,
      }),

      // Redis/Bull Queue health
      async () => {
        try {
          const isReady = await this.workflowQueue.isReady();
          const jobCounts = await this.workflowQueue.getJobCounts();
          
          return {
            queue: {
              status: isReady ? 'up' : 'down',
              details: {
                name: 'workflow',
                jobCounts,
              },
            },
          };
        } catch (error) {
          return {
            queue: {
              status: 'down',
              error: error.message,
            },
          };
        }
      },
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    try {
      await this.db.pingCheck('database');
      return { status: 'ready' };
    } catch {
      throw new Error('Service not ready');
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'live' };
  }
}