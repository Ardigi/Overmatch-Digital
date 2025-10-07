import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { SecretsHealthIndicator } from './secrets-health.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [SecretsHealthIndicator],
  exports: [SecretsHealthIndicator],
})
export class HealthModule {}
