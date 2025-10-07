import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { RedisModule } from '../redis/redis.module';
import { FinancialModule } from '../financial/financial.module';
import { RiskSimulator } from './simulators/risk-simulator';
import { LossEventFrequencyCalculator } from './calculators/loss-event-frequency.calculator';
import { LossMagnitudeCalculator } from './calculators/loss-magnitude.calculator';
import { ThreatEvent } from './entities/threat-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThreatEvent]),
    RedisModule,
    FinancialModule,
    MonitoringModule,
  ],
  providers: [
    RiskSimulator,
    LossEventFrequencyCalculator,
    LossMagnitudeCalculator,
  ],
  exports: [
    RiskSimulator,
    LossEventFrequencyCalculator,
    LossMagnitudeCalculator,
  ],
})
export class RiskModule {}