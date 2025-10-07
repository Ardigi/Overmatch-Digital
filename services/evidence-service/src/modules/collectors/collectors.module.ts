import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '../../kafka/kafka.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { AwsCollectorService } from './aws/aws-collector.service';
import { AzureCollectorService } from './azure/azure-collector.service';
import { CollectorEvidenceService } from './base/collector-evidence.service';
import { GCPCollectorService } from './gcp/gcp-collector.service';

@Module({
  imports: [ConfigModule, EvidenceModule, KafkaModule],
  controllers: [],
  providers: [
    CollectorEvidenceService,
    AwsCollectorService,
    AzureCollectorService,
    GCPCollectorService,
  ],
  exports: [
    CollectorEvidenceService,
    AwsCollectorService,
    AzureCollectorService,
    GCPCollectorService,
  ],
})
export class CollectorsModule {}
