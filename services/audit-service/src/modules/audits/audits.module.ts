import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { FindingsController } from '../findings/findings.controller';
import { SOCAuditsModule } from '../soc-audits/soc-audits.module';
import { AuditIntegrationService } from './audit-integration.service';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';

@Module({
  imports: [SOCAuditsModule, AuditTrailModule],
  controllers: [AuditsController, FindingsController],
  providers: [AuditsService, AuditIntegrationService],
  exports: [AuditsService, AuditIntegrationService],
})
export class AuditsModule {}
