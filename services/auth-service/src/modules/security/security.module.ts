import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { EventsModule } from '../events/events.module';
import { RedisModule } from '../redis/redis.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AccessControlService } from './access-control.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { EncryptionService } from './encryption.service';
import { MonitoringService } from './monitoring.service';
import { RiskAssessmentService } from './risk-assessment.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, AuditLog]),
    RedisModule,
    EventsModule,
    AuditModule,
    SharedAuthModule, // Use SharedAuthModule for guards and decorators
  ],
  controllers: [SecurityController],
  providers: [
    RiskAssessmentService,
    DeviceFingerprintService,
    AccessControlService,
    EncryptionService,
    MonitoringService,
  ],
  exports: [
    RiskAssessmentService,
    DeviceFingerprintService,
    AccessControlService,
    EncryptionService,
    MonitoringService,
  ],
})
export class SecurityModule {}
