import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../../kafka/kafka.module';
import { ControlsModule } from '../controls/controls.module';
import { ControlTestProcessor } from './control-test.processor';
import { ControlTestsController } from './control-tests.controller';
import { ControlTestsService } from './control-tests.service';
import { ControlTest } from './entities/control-test.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ControlTest]),
    BullModule.registerQueue({
      name: 'control-tests',
    }),
    ControlsModule,
    KafkaModule.forRoot(),
  ],
  controllers: [ControlTestsController],
  providers: [ControlTestsService, ControlTestProcessor],
  exports: [ControlTestsService],
})
export class ControlTestsModule {}
