import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';
import { AuditEntry } from './entities/audit-entry.entity';
import { AuditSession } from './entities/audit-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry, AuditSession])],
  controllers: [AuditTrailController],
  providers: [AuditTrailService],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}
