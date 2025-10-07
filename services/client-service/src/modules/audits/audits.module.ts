import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';
import { AuditTrail } from './entities/audit-trail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditTrail]), EventEmitterModule],
  controllers: [AuditsController],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}
