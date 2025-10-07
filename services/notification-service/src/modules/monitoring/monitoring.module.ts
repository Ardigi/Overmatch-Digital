import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';

@Module({
  providers: [MetricsService, MonitoringService],
  exports: [MetricsService, MonitoringService],
})
export class MonitoringModule {}