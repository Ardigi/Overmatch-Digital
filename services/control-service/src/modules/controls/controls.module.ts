import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { KafkaModule } from '../../kafka/kafka.module';
import { FrameworksModule } from '../frameworks/frameworks.module';
import { ControlsController } from './controls.controller';
import { ControlsService } from './controls.service';
import { Control } from './entities/control.entity';
import { ControlAssessment } from './entities/control-assessment.entity';
import { ControlException } from './entities/control-exception.entity';
import { ControlImplementation } from '../implementation/entities/control-implementation.entity';
import { ControlMapping } from './entities/control-mapping.entity';
import { ControlTestResult } from './entities/control-test-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Control,
      ControlImplementation,
      ControlTestResult,
      ControlException,
      ControlAssessment,
      ControlMapping,
    ]),
    KafkaModule.forRoot(),
    FrameworksModule,
    MonitoringModule,
  ],
  controllers: [ControlsController],
  providers: [ControlsService],
  exports: [ControlsService],
})
export class ControlsModule {}
