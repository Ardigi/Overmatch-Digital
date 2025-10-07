import { Controller, Get } from '@nestjs/common';
import {
  type DiskHealthIndicator,
  HealthCheck,
  type HealthCheckService,
  type MemoryHealthIndicator,
  type TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
      () => this.memory.checkRSS('memory_rss', 3000 * 1024 * 1024), // 3GB
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024)]);
  }
}
