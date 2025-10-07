import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditFinding } from '../soc-audits/entities/audit-finding.entity';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditFinding])],
  controllers: [FindingsController],
  providers: [FindingsService],
  exports: [FindingsService],
})
export class FindingsModule {}
