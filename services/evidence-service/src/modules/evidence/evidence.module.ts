import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { AWSCollector } from '../collectors/aws/aws.collector';
import { AzureCollector } from '../collectors/azure/azure.collector';
import { CollectorManagerService } from '../collectors/collector-manager.service';
import { CollectorsController } from '../collectors/collectors.controller';
import { GitHubCollector } from '../collectors/github/github.collector';
import { EvidenceValidationService } from '../validation/evidence-validation.service';
import { ValidationController } from '../validation/validation.controller';
import { Evidence } from './entities/evidence.entity';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Evidence]), ScheduleModule.forRoot()],
  controllers: [EvidenceController, CollectorsController, ValidationController],
  providers: [
    EvidenceService,
    CollectorManagerService,
    EvidenceValidationService,
    AWSCollector,
    AzureCollector,
    GitHubCollector,
    MetricsService,
    TracingService,
    LoggingService,
  ],
  exports: [EvidenceService, CollectorManagerService, EvidenceValidationService],
})
export class EvidenceModule {}
