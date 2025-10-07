import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditsModule } from '../audits/audits.module';
import { SharedClientModule } from '../shared-client/shared-client.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client, ClientAudit, ClientDocument, ClientUser } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientUser, ClientDocument, ClientAudit]),
    SharedClientModule, // Provides ContractCoreService without circular dependency
    AuditsModule,
    // EventsModule will be imported in app.module.ts to avoid circular dependency
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService, TypeOrmModule],
})
export class ClientsModule {}
