import { Module } from '@nestjs/common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { RedisModule } from '../redis/redis.module';
import { AdvancedRoiService } from './advanced-roi.service';
import { NpvIrrCalculator } from './calculators/npv-irr.calculator';
import { MonteCarloSimulator } from './simulators/monte-carlo.simulator';

@Module({
  imports: [
    RedisModule,
    MonitoringModule, // Import the module that provides LoggingService
  ],
  providers: [
    AdvancedRoiService,
    NpvIrrCalculator,
    MonteCarloSimulator,
  ],
  exports: [
    AdvancedRoiService,
    NpvIrrCalculator,
    MonteCarloSimulator,
  ],
})
export class FinancialModule {}