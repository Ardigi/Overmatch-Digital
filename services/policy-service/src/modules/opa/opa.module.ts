import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpaService } from './opa.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [OpaService],
  exports: [OpaService],
})
export class OpaModule {}
