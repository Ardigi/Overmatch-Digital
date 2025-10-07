import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedClientModule } from '../shared-client/shared-client.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { ContractLineItem } from './entities/contract-line-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractLineItem]),
    SharedClientModule, // Provides ClientCoreService without circular dependency
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
