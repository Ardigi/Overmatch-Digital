import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Control } from '../compliance/entities/control.entity';
import { ComplianceFramework } from '../compliance/entities/framework.entity';
import { ControlsController } from './controls.controller';
import { ControlsService } from '../compliance/controls.service';
import { CacheModule } from '../cache/cache.module';
import { SearchModule } from '../search/search.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forFeature([Control, ComplianceFramework]),
    CacheModule,
    SearchModule,
  ],
  controllers: [ControlsController],
  providers: [ControlsService, EventEmitter2],
  exports: [ControlsService],
})
export class ControlsModule {}
