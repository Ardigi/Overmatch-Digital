import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from './entities/integration.entity';
import { IntegrationCredential } from './entities/integration-credential.entity';
import { IntegrationLog } from './entities/integration-log.entity';
import { IntegrationsController } from './integrations.controller';
import { ConnectorFactory } from './services/connector.factory';
import { CredentialService } from './services/credential.service';
import { HealthCheckService } from './services/health-check.service';
import { IntegrationService } from './services/integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, IntegrationLog, IntegrationCredential]),
    BullModule.registerQueue({
      name: 'integration-jobs',
    }),
    HttpModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationService, ConnectorFactory, HealthCheckService, CredentialService],
  exports: [IntegrationService, ConnectorFactory, HealthCheckService, CredentialService],
})
export class IntegrationsModule {}
