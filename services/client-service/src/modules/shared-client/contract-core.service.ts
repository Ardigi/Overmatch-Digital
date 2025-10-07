import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Contract, ContractStatus } from '../contracts/entities/contract.entity';
import { ContractLineItem } from '../contracts/entities/contract-line-item.entity';

/**
 * ContractCoreService provides essential contract operations without circular dependencies.
 * This service contains only the methods needed by other services like ClientsService.
 * 
 * Methods included:
 * - findActiveByClientId: Get active contracts for a client (needed by ClientsService)
 * - exists: Check if contract exists
 * - Basic validation methods
 * 
 * Methods NOT included:
 * - create, update, delete (these remain in ContractsService)
 * - Complex business logic that depends on other services
 */
@Injectable()
export class ContractCoreService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractLineItem)
    private readonly lineItemRepository: Repository<ContractLineItem>,
  ) {}

  /**
   * Find active contracts by client ID
   * This is the core method needed by ClientsService for archive validation
   */
  async findActiveByClientId(clientId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: {
        clientId,
        status: In([ContractStatus.ACTIVE, ContractStatus.SIGNED]),
      },
      relations: ['lineItems'],
    });
  }

  /**
   * Check if a contract exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.contractRepository.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Get contract basic info by ID
   */
  async findBasicInfo(id: string): Promise<{ id: string; contractNumber: string; type: string; endDate: Date } | null> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      select: ['id', 'contractNumber', 'type', 'endDate'],
    });
    
    return contract;
  }

  /**
   * Find contracts by client ID with basic info
   */
  async findByClientId(clientId: string): Promise<Array<{ id: string; contractNumber: string; type: string; endDate: Date; status: ContractStatus }>> {
    const contracts = await this.contractRepository.find({
      where: { clientId },
      select: ['id', 'contractNumber', 'type', 'endDate', 'status'],
      order: { createdAt: 'DESC' },
    });
    
    return contracts;
  }

  /**
   * Get active contracts count for a client
   */
  async getActiveContractsCount(clientId: string): Promise<number> {
    return this.contractRepository.count({
      where: {
        clientId,
        status: In([ContractStatus.ACTIVE, ContractStatus.SIGNED]),
      },
    });
  }

  /**
   * Get total contract value for a client
   */
  async getTotalContractValue(clientId: string): Promise<number> {
    const contracts = await this.contractRepository.find({
      where: {
        clientId,
        status: In([ContractStatus.ACTIVE, ContractStatus.SIGNED]),
      },
      select: ['totalValue'],
    });
    
    return contracts.reduce((sum, contract) => sum + Number(contract.totalValue), 0);
  }

  /**
   * Get contracts expiring within specified days
   */
  async getExpiringContracts(clientId: string, daysAhead: number = 90): Promise<Contract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.contractRepository.find({
      where: {
        clientId,
        status: ContractStatus.ACTIVE,
        endDate: LessThanOrEqual(futureDate),
      },
      select: ['id', 'contractNumber', 'type', 'endDate', 'totalValue'],
      order: {
        endDate: 'ASC',
      },
    });
  }

  /**
   * Check if client has any active contracts
   */
  async hasActiveContracts(clientId: string): Promise<boolean> {
    const count = await this.getActiveContractsCount(clientId);
    return count > 0;
  }
}
