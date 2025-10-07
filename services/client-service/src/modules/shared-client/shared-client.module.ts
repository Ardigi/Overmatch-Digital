import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditTrail } from '../audits/entities/audit-trail.entity';
// Entities needed by shared services
import { Client } from '../clients/entities/client.entity';
import { ClientAudit } from '../clients/entities/client-audit.entity';
import { ClientDocument } from '../clients/entities/client-document.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractLineItem } from '../contracts/entities/contract-line-item.entity';
// Import modules that don't cause circular dependencies
import { RedisModule } from '../redis/redis.module';
// Core services that can be shared without circular dependencies
import { ClientCoreService } from './client-core.service';
import { ContractCoreService } from './contract-core.service';

/**
 * SharedClientModule contains common client and contract utilities that can be
 * safely imported by other modules without causing circular dependencies.
 *
 * This module exports:
 * - Core services (ClientCore, ContractCore) with essential methods
 * - TypeORM repositories for direct access
 *
 * It does NOT include:
 * - Full ClientsService or ContractsService (to avoid circular dependencies)
 * - Controllers
 * - Services that depend on other feature modules
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    TypeOrmModule.forFeature([
      Client,
      ClientUser,
      ClientDocument,
      ClientAudit,
      Contract,
      ContractLineItem,
      AuditTrail,
    ]),
    RedisModule,
  ],
  providers: [
    // Core services with essential methods only
    ClientCoreService,
    ContractCoreService,
  ],
  exports: [
    // Export core services that other modules need
    ClientCoreService,
    ContractCoreService,

    // Export TypeORM for entity access
    TypeOrmModule,
  ],
})
export class SharedClientModule {}
