import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ClientCoreService } from '../shared-client/client-core.service';
import type {
  AddLineItemDto,
  CreateContractDto,
  QueryContractDto,
  UpdateContractDto,
  UpdateLineItemDto,
} from './dto';
import { BillingFrequency, Contract, ContractStatus } from './entities/contract.entity';
import { ContractLineItem } from './entities/contract-line-item.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractLineItem)
    private readonly lineItemRepository: Repository<ContractLineItem>,
    private readonly clientCoreService: ClientCoreService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createContractDto: CreateContractDto, userId: string): Promise<Contract> {
    // Validate client exists
    await this.clientCoreService.findOne(createContractDto.clientId);

    // Generate contract number
    const contractNumber = await this.generateContractNumber(createContractDto.clientId);

    // Create contract
    const contract = this.contractRepository.create({
      ...createContractDto,
      contractNumber,
      createdBy: userId,
      updatedBy: userId,
    });

    // Calculate monthly value based on billing frequency
    contract.monthlyValue = this.calculateMonthlyValue(
      contract.totalValue,
      contract.billingFrequency,
    );

    const savedContract = await this.contractRepository.save(contract);

    // Create line items if provided
    if (createContractDto.lineItems && createContractDto.lineItems.length > 0) {
      const lineItems = createContractDto.lineItems.map((item, index) => ({
        ...item,
        contractId: savedContract.id,
        sortOrder: index,
        createdBy: userId,
      }));

      await this.lineItemRepository.save(lineItems);
    }

    // Emit event
    this.eventEmitter.emit('contract.created', {
      contract: savedContract,
      userId,
      timestamp: new Date(),
    });

    return this.findOne(savedContract.id);
  }

  async findAll(query: QueryContractDto): Promise<{
    data: Contract[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      clientId,
      status,
      type,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
      billingFrequency,
      minValue,
      maxValue,
      expiringSoon,
      autoRenew,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.contractRepository.createQueryBuilder('contract');

    // Filters
    if (clientId) {
      queryBuilder.andWhere('contract.clientId = :clientId', { clientId });
    }

    if (status) {
      queryBuilder.andWhere('contract.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('contract.type = :type', { type });
    }

    if (startDateFrom || startDateTo) {
      if (startDateFrom && startDateTo) {
        queryBuilder.andWhere('contract.startDate BETWEEN :startDateFrom AND :startDateTo', {
          startDateFrom,
          startDateTo,
        });
      } else if (startDateFrom) {
        queryBuilder.andWhere('contract.startDate >= :startDateFrom', { startDateFrom });
      } else {
        queryBuilder.andWhere('contract.startDate <= :startDateTo', { startDateTo });
      }
    }

    if (endDateFrom || endDateTo) {
      if (endDateFrom && endDateTo) {
        queryBuilder.andWhere('contract.endDate BETWEEN :endDateFrom AND :endDateTo', {
          endDateFrom,
          endDateTo,
        });
      } else if (endDateFrom) {
        queryBuilder.andWhere('contract.endDate >= :endDateFrom', { endDateFrom });
      } else {
        queryBuilder.andWhere('contract.endDate <= :endDateTo', { endDateTo });
      }
    }

    if (billingFrequency) {
      queryBuilder.andWhere('contract.billingFrequency = :billingFrequency', {
        billingFrequency,
      });
    }

    if (minValue !== undefined || maxValue !== undefined) {
      if (minValue !== undefined && maxValue !== undefined) {
        queryBuilder.andWhere('contract.totalValue BETWEEN :minValue AND :maxValue', {
          minValue,
          maxValue,
        });
      } else if (minValue !== undefined) {
        queryBuilder.andWhere('contract.totalValue >= :minValue', { minValue });
      } else {
        queryBuilder.andWhere('contract.totalValue <= :maxValue', { maxValue });
      }
    }

    if (expiringSoon !== undefined) {
      const daysAhead = 90;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      queryBuilder.andWhere('contract.endDate <= :futureDate', { futureDate });
      queryBuilder.andWhere('contract.status = :activeStatus', {
        activeStatus: ContractStatus.ACTIVE,
      });
    }

    if (autoRenew !== undefined) {
      queryBuilder.andWhere('contract.autoRenew = :autoRenew', { autoRenew });
    }

    // Relations
    queryBuilder.leftJoinAndSelect('contract.client', 'client');
    queryBuilder.leftJoinAndSelect('contract.lineItems', 'lineItems');
    queryBuilder.leftJoinAndSelect('contract.amendments', 'amendments');

    // Sorting
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'contractNumber',
      'startDate',
      'endDate',
      'totalValue',
      'monthlyValue',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`contract.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['client', 'lineItems', 'parentContract', 'amendments'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  async findActiveByClientId(clientId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: {
        clientId,
        status: In([ContractStatus.ACTIVE, ContractStatus.SIGNED]),
      },
      relations: ['lineItems'],
    });
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    userId: string,
  ): Promise<Contract> {
    const contract = await this.findOne(id);

    if (contract.status === ContractStatus.TERMINATED) {
      throw new BadRequestException('Cannot update a terminated contract');
    }

    // Track changes
    const changes = {};
    Object.keys(updateContractDto).forEach(key => {
      if (contract[key] !== updateContractDto[key]) {
        changes[key] = {
          old: contract[key],
          new: updateContractDto[key],
        };
      }
    });

    // Update contract
    Object.assign(contract, {
      ...updateContractDto,
      updatedBy: userId,
    });

    // Recalculate monthly value if needed
    if (updateContractDto.totalValue || updateContractDto.billingFrequency) {
      contract.monthlyValue = this.calculateMonthlyValue(
        contract.totalValue,
        contract.billingFrequency,
      );
    }

    const updatedContract = await this.contractRepository.save(contract);

    // Emit event
    this.eventEmitter.emit('contract.updated', {
      contract: updatedContract,
      changes,
      userId,
      timestamp: new Date(),
    });

    return this.findOne(id);
  }

  async sign(
    id: string,
    signatureData: {
      clientSignatory: string;
      clientSignatoryTitle: string;
      clientSignatoryEmail: string;
      mspSignatory: string;
      mspSignatoryTitle: string;
    },
    userId: string,
  ): Promise<Contract> {
    const contract = await this.findOne(id);

    if (contract.status !== ContractStatus.SENT) {
      throw new BadRequestException('Contract must be in SENT status to be signed');
    }

    Object.assign(contract, {
      ...signatureData,
      status: ContractStatus.SIGNED,
      signedDate: new Date(),
      signedBy: userId,
      updatedBy: userId,
    });

    const signedContract = await this.contractRepository.save(contract);

    // Emit event
    this.eventEmitter.emit('contract.signed', {
      contract: signedContract,
      userId,
      timestamp: new Date(),
    });

    // Auto-activate if start date is today or in the past
    if (new Date(contract.startDate) <= new Date()) {
      await this.activate(id, userId);
    }

    return this.findOne(id);
  }

  async activate(id: string, userId: string): Promise<Contract> {
    const contract = await this.findOne(id);

    if (![ContractStatus.SIGNED, ContractStatus.ACTIVE].includes(contract.status)) {
      throw new BadRequestException('Contract must be signed before activation');
    }

    contract.status = ContractStatus.ACTIVE;
    contract.updatedBy = userId;

    const activatedContract = await this.contractRepository.save(contract);

    // Emit event
    this.eventEmitter.emit('contract.activated', {
      contract: activatedContract,
      userId,
      timestamp: new Date(),
    });

    return activatedContract;
  }

  async terminate(
    id: string,
    reason: string,
    effectiveDate: Date,
    userId: string,
  ): Promise<Contract> {
    const contract = await this.findOne(id);

    if (contract.status === ContractStatus.TERMINATED) {
      throw new BadRequestException('Contract is already terminated');
    }

    contract.status = ContractStatus.TERMINATED;
    contract.updatedBy = userId;
    contract.metadata = {
      ...contract.metadata,
      terminationReason: reason,
      terminationDate: effectiveDate,
      terminatedBy: userId,
    };

    const terminatedContract = await this.contractRepository.save(contract);

    // Emit event
    this.eventEmitter.emit('contract.terminated', {
      contract: terminatedContract,
      reason,
      effectiveDate,
      userId,
      timestamp: new Date(),
    });

    return terminatedContract;
  }

  async renew(id: string, renewalData: {
    newEndDate: Date;
    priceAdjustment?: number;
    notes?: string;
  }, userId: string): Promise<Contract> {
    const contract = await this.findOne(id);

    if (!contract.autoRenew) {
      throw new BadRequestException('Contract is not set for auto-renewal');
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Only active contracts can be renewed');
    }

    const previousEndDate = contract.endDate;
    contract.endDate = renewalData.newEndDate;

    if (renewalData.priceAdjustment) {
      contract.totalValue = Number(contract.totalValue) + renewalData.priceAdjustment;
      contract.monthlyValue = this.calculateMonthlyValue(
        contract.totalValue,
        contract.billingFrequency,
      );
    }

    // Update renewal history
    contract.renewalHistory = [
      ...(contract.renewalHistory || []),
      {
        date: new Date(),
        previousEndDate,
        newEndDate: renewalData.newEndDate,
        renewedBy: userId,
        changes: renewalData.notes,
      },
    ];

    contract.status = ContractStatus.RENEWED;
    contract.updatedBy = userId;

    const renewedContract = await this.contractRepository.save(contract);

    // Emit event
    this.eventEmitter.emit('contract.renewed', {
      contract: renewedContract,
      previousEndDate,
      userId,
      timestamp: new Date(),
    });

    return renewedContract;
  }

  async addLineItem(
    contractId: string,
    addLineItemDto: AddLineItemDto,
    userId: string,
  ): Promise<ContractLineItem> {
    const contract = await this.findOne(contractId);

    const lineItem = this.lineItemRepository.create({
      ...addLineItemDto,
      contractId,
      createdBy: userId,
      updatedBy: userId,
    });

    // Calculate total price
    lineItem.totalPrice = lineItem.calculateTotal();

    const savedLineItem = await this.lineItemRepository.save(lineItem);

    // Update contract total
    await this.updateContractTotals(contractId, userId);

    return savedLineItem;
  }

  async updateLineItem(
    contractId: string,
    lineItemId: string,
    updateLineItemDto: UpdateLineItemDto,
    userId: string,
  ): Promise<ContractLineItem> {
    const lineItem = await this.lineItemRepository.findOne({
      where: { id: lineItemId, contractId },
    });

    if (!lineItem) {
      throw new NotFoundException('Line item not found');
    }

    Object.assign(lineItem, {
      ...updateLineItemDto,
      updatedBy: userId,
    });

    // Recalculate total
    lineItem.totalPrice = lineItem.calculateTotal();

    const updatedLineItem = await this.lineItemRepository.save(lineItem);

    // Update contract totals
    await this.updateContractTotals(contractId, userId);

    return updatedLineItem;
  }

  async removeLineItem(
    contractId: string,
    lineItemId: string,
    userId: string,
  ): Promise<void> {
    const lineItem = await this.lineItemRepository.findOne({
      where: { id: lineItemId, contractId },
    });

    if (!lineItem) {
      throw new NotFoundException('Line item not found');
    }

    await this.lineItemRepository.remove(lineItem);

    // Update contract totals
    await this.updateContractTotals(contractId, userId);
  }

  async getExpiringContracts(daysAhead: number = 90): Promise<Contract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.contractRepository.find({
      where: {
        status: ContractStatus.ACTIVE,
        endDate: LessThanOrEqual(futureDate),
      },
      relations: ['client'],
      order: {
        endDate: 'ASC',
      },
    });
  }

  async getContractMetrics(clientId?: string): Promise<{
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    monthlyRecurringRevenue: number;
    averageContractValue: number;
    contractsByStatus: Record<string, number>;
    contractsByType: Record<string, number>;
    upcomingRenewals: number;
    expiringContracts: number;
  }> {
    const query: any = {};
    if (clientId) {
      query.clientId = clientId;
    }

    const contracts = await this.contractRepository.find({ where: query });
    const activeContracts = contracts.filter(c => c.status === ContractStatus.ACTIVE);
    const expiringContracts = await this.getExpiringContracts(90);
    const upcomingRenewals = activeContracts.filter(c => c.autoRenew && c.isExpiringSoon(90));

    const totalValue = contracts.reduce((sum, c) => sum + Number(c.totalValue), 0);
    const mrr = activeContracts.reduce((sum, c) => sum + Number(c.monthlyValue), 0);

    const contractsByStatus: Record<string, number> = {};
    const contractsByType: Record<string, number> = {};

    contracts.forEach(contract => {
      contractsByStatus[contract.status] = (contractsByStatus[contract.status] || 0) + 1;
      contractsByType[contract.type] = (contractsByType[contract.type] || 0) + 1;
    });

    return {
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      totalValue,
      monthlyRecurringRevenue: mrr,
      averageContractValue: contracts.length > 0 ? totalValue / contracts.length : 0,
      contractsByStatus,
      contractsByType,
      upcomingRenewals: upcomingRenewals.length,
      expiringContracts: expiringContracts.length,
    };
  }

  private async generateContractNumber(clientId: string): Promise<string> {
    const client = await this.clientCoreService.getClientInfo(clientId);
    const year = new Date().getFullYear();
    const count = await this.contractRepository.count({
      where: {
        clientId,
        createdAt: MoreThanOrEqual(new Date(`${year}-01-01`)),
      },
    });

    const clientPrefix = client.slug.toUpperCase().substring(0, 3);
    const sequenceNumber = String(count + 1).padStart(4, '0');

    return `${clientPrefix}-${year}-${sequenceNumber}`;
  }

  private calculateMonthlyValue(totalValue: number, billingFrequency: BillingFrequency): number {
    switch (billingFrequency) {
      case BillingFrequency.MONTHLY:
        return totalValue;
      case BillingFrequency.QUARTERLY:
        return totalValue / 3;
      case BillingFrequency.SEMI_ANNUAL:
        return totalValue / 6;
      case BillingFrequency.ANNUAL:
        return totalValue / 12;
      default:
        return 0;
    }
  }

  private async updateContractTotals(contractId: string, userId: string): Promise<void> {
    const contract = await this.findOne(contractId);
    const lineItems = await this.lineItemRepository.find({ where: { contractId } });

    const totalValue = lineItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    contract.totalValue = totalValue;
    contract.monthlyValue = this.calculateMonthlyValue(totalValue, contract.billingFrequency);
    contract.updatedBy = userId;

    await this.contractRepository.save(contract);
  }
}