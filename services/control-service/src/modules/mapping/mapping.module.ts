import { Module } from '@nestjs/common';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { ControlsModule } from '../controls/controls.module';
import { MappingController } from './mapping.controller';
import { MappingService } from './mapping.service';

@Module({
  imports: [ControlsModule, HttpCommonModule],
  controllers: [MappingController],
  providers: [MappingService],
  exports: [MappingService],
})
export class MappingModule {}
