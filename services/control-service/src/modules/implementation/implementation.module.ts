import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../../kafka/kafka.module';
import { ControlsModule } from '../controls/controls.module';
import { Control } from '../controls/entities/control.entity';
import { ControlImplementation } from './entities/control-implementation.entity';
import { ImplementationController } from './implementation.controller';
import { ImplementationService } from './implementation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ControlImplementation, Control]), ControlsModule, KafkaModule.forRoot()],
  controllers: [ImplementationController],
  providers: [ImplementationService],
  exports: [ImplementationService],
})
export class ImplementationModule {}
