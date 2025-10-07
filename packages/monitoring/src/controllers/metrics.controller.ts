import { Controller, Get, Header } from '@nestjs/common';
import { SkipMetrics, SkipTracing } from '../decorators';
import { MetricsService } from '../metrics';

@Controller()
@SkipMetrics()
@SkipTracing()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/metrics')
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Get('/health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: this.metricsService.config.serviceName,
    };
  }

  @Get('/health/ready')
  ready() {
    // TODO: Add actual readiness checks (database, cache, etc.)
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: this.metricsService.config.serviceName,
    };
  }

  @Get('/health/live')
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: this.metricsService.config.serviceName,
    };
  }
}
