import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Control } from '../compliance/entities/control.entity';
import { ComplianceFramework } from '../compliance/entities/framework.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Risk } from '../risks/entities/risk.entity';
import { EnhancedKafkaService } from './enhanced-kafka.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaService } from './kafka.service';

@Module({
  imports: [TypeOrmModule.forFeature([Risk, Control, Policy, ComplianceFramework])],
  providers: [KafkaConsumerService, KafkaService, EnhancedKafkaService],
  exports: [KafkaConsumerService, KafkaService, EnhancedKafkaService],
})
export class EventsModule {}
