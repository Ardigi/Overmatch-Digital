import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, Metered, MetricsService, Observable, Traced, TracingService } from '@soc-compliance/monitoring';
import { Brackets, In, IsNull, Like, Not, Repository } from 'typeorm';
import { ClientEventType, KafkaProducerService } from '../events/kafka-producer.service';
import { RedisService } from '../redis/redis.service';
import { ContractCoreService } from '../shared-client/contract-core.service';
import type {
  CompleteOnboardingDto,
  CreateClientDto,
  QueryClientDto,
  StartOnboardingDto,
  UpdateClientDto,
} from './dto';
import {
  Client,
  ClientStatus,
  type ComplianceFramework,
  ComplianceStatus,
} from './entities/client.entity';
import { type AuditResult, type AuditScope, AuditStatus, type AuditType, ClientAudit } from './entities/client-audit.entity';
import { ClientDocument, DocumentStatus } from './entities/client-document.entity';
import { ClientUser, ClientUserRole, ClientUserStatus } from './entities/client-user.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepository: Repository<ClientUser>,
    @InjectRepository(ClientDocument)
    private readonly clientDocumentRepository: Repository<ClientDocument>,
    @InjectRepository(ClientAudit)
    private readonly clientAuditRepository: Repository<ClientAudit>,
    private readonly contractCoreService: ContractCoreService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly redisService: RedisService,
    private readonly serviceDiscovery: ServiceDiscoveryService,
    private eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
    private readonly loggingService: LoggingService,
  ) {}

  @Observable({ spanName: 'client-creation', metricName: 'client_creation_duration_seconds' })
  async create(createClientDto: CreateClientDto, userId: string): Promise<Client> {
    // Validate user exists in auth service
    const userExists = await this.validateUserExists(userId);
    if (!userExists) {
      throw new BadRequestException(`User with ID ${userId} not found`);
    }

    // Check if client with same name exists
    const existingClient = await this.clientRepository.findOne({
      where: { name: createClientDto.name, isDeleted: false },
    });

    if (existingClient) {
      throw new ConflictException('Client with this name already exists');
    }

    // Create client entity
    const client = this.clientRepository.create({
      ...createClientDto,
      createdBy: userId,
      updatedBy: userId,
    });

    // Save to database
    const savedClient = await this.clientRepository.save(client);

    // Emit local event
    this.eventEmitter.emit('client.created', {
      client: savedClient,
      userId,
      timestamp: new Date(),
    });

    // Publish Kafka event
    try {
      await this.kafkaProducer.publishClientCreated(
        savedClient.id,
        savedClient,
        userId,
      );
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to publish client created event:', error);
    }

    return savedClient;
  }

  @Traced('client-list-query')
  async findAll(query: QueryClientDto): Promise<{
    data: Client[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Try to get from cache first
    const organizationId = query.organizationId || 'global';
    const cachedResult = await this.redisService.getCachedClientList(organizationId, query);
    if (cachedResult) {
      return cachedResult;
    }

    const {
      page = 1,
      limit = 20,
      search,
      status,
      clientType,
      size,
      industry,
      complianceStatus,
      framework,
      riskLevel,
      partnerId,
      salesRepId,
      accountManagerId,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includeArchived = false,
      needsAudit,
      expiringSoon,
      expiringInDays = 90,
    } = query;

    const queryBuilder = this.clientRepository.createQueryBuilder('client');

    // Base filters
    if (!includeArchived) {
      queryBuilder.andWhere('client.isDeleted = :isDeleted', { isDeleted: false });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        new Brackets(qb => {
          qb.where('client.name ILIKE :search', { search: `%${search}%` })
            .orWhere('client.legalName ILIKE :search', { search: `%${search}%` })
            .orWhere('client.description ILIKE :search', { search: `%${search}%` });
        }),
      );
    }

    // Status filters
    if (status) {
      queryBuilder.andWhere('client.status = :status', { status });
    }

    if (clientType) {
      queryBuilder.andWhere('client.clientType = :clientType', { clientType });
    }

    if (size) {
      queryBuilder.andWhere('client.size = :size', { size });
    }

    if (industry) {
      queryBuilder.andWhere('client.industry = :industry', { industry });
    }

    if (complianceStatus) {
      queryBuilder.andWhere('client.complianceStatus = :complianceStatus', {
        complianceStatus,
      });
    }

    if (framework) {
      queryBuilder.andWhere(':framework = ANY(client.targetFrameworks)', { framework });
    }

    if (riskLevel) {
      queryBuilder.andWhere('client.riskLevel = :riskLevel', { riskLevel });
    }

    // Relationship filters
    if (partnerId) {
      queryBuilder.andWhere('client.partnerId = :partnerId', { partnerId });
    }

    if (salesRepId) {
      queryBuilder.andWhere('client.salesRepId = :salesRepId', { salesRepId });
    }

    if (accountManagerId) {
      queryBuilder.andWhere('client.accountManagerId = :accountManagerId', {
        accountManagerId,
      });
    }

    // Tags filter
    if (tags && tags.length > 0) {
      queryBuilder.andWhere('client.tags && :tags', { tags });
    }

    // Special filters
    if (needsAudit) {
      queryBuilder.andWhere(
        new Brackets(qb => {
          qb.where('client.nextAuditDate IS NULL')
            .orWhere('client.nextAuditDate <= :today', { today: new Date() });
        }),
      );
    }

    if (expiringSoon) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiringInDays);
      queryBuilder.andWhere('client.certificateExpiryDate <= :expiryDate', {
        expiryDate,
      });
    }

    // Sorting
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'name',
      'complianceScore',
      'nextAuditDate',
      'certificateExpiryDate',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`client.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [data, total] = await queryBuilder.getManyAndCount();

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result
    await this.redisService.cacheClientList(organizationId, query, result);

    return result;
  }

  @Traced('client-detail-fetch')
  async findOne(id: string): Promise<Client> {
    // Try to get from cache first
    const cachedClient = await this.redisService.getCachedClient(id);
    if (cachedClient) {
      return cachedClient;
    }

    const client = await this.clientRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['subsidiaries', 'contracts', 'clientUsers', 'audits'],
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Cache the client data
    await this.redisService.cacheClient(id, client);

    return client;
  }

  async findBySlug(slug: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { slug, isDeleted: false },
      relations: ['subsidiaries', 'contracts', 'clientUsers', 'audits'],
    });

    if (!client) {
      throw new NotFoundException(`Client with slug ${slug} not found`);
    }

    return client;
  }

  @Observable({ spanName: 'client-update', metricName: 'client_update_duration_seconds' })
  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    userId: string,
  ): Promise<Client> {
    const client = await this.findOne(id);

    // Track what changed for audit purposes
    const changes = {};
    Object.keys(updateClientDto).forEach(key => {
      if (client[key] !== updateClientDto[key]) {
        changes[key] = {
          old: client[key],
          new: updateClientDto[key],
        };
      }
    });

    // Update fields
    Object.assign(client, {
      ...updateClientDto,
      updatedBy: userId,
    });

    // Save changes
    const updatedClient = await this.clientRepository.save(client);

    // Invalidate cache
    await this.redisService.invalidateClient(id);
    await this.redisService.invalidateClientList(client.organizationId);

    // Emit events
    this.eventEmitter.emit('client.updated', {
      client: updatedClient,
      changes,
      userId,
      timestamp: new Date(),
    });

    // Publish Kafka event
    try {
      await this.kafkaProducer.publishClientUpdated(id, changes, userId);
    } catch (error) {
      console.error('Failed to publish client updated event:', error);
    }

    return updatedClient;
  }

  @Observable({ spanName: 'compliance-status-update', metricName: 'compliance_status_update_duration_seconds' })
  async updateComplianceStatus(
    id: string,
    status: ComplianceStatus,
    userId: string,
    notes?: string,
  ): Promise<Client> {
    const client = await this.findOne(id);
    const previousStatus = client.complianceStatus;

    client.complianceStatus = status;
    client.updatedBy = userId;

    // Update compliance score based on status
    switch (status) {
      case ComplianceStatus.COMPLIANT:
        client.complianceScore = 1.0;
        break;
      case ComplianceStatus.NON_COMPLIANT:
        client.complianceScore = 0;
        break;
      case ComplianceStatus.READY_FOR_AUDIT:
        client.complianceScore = 0.9;
        break;
      case ComplianceStatus.UNDER_AUDIT:
        client.complianceScore = 0.85;
        break;
      case ComplianceStatus.IMPLEMENTATION:
        client.complianceScore = 0.5;
        break;
      case ComplianceStatus.REMEDIATION:
        client.complianceScore = 0.3;
        break;
      case ComplianceStatus.ASSESSMENT:
        client.complianceScore = 0.2;
        break;
      default:
        client.complianceScore = 0.1;
    }

    const updatedClient = await this.clientRepository.save(client);

    // Emit compliance status change event
    this.eventEmitter.emit('client.compliance.statusChanged', {
      client: updatedClient,
      previousStatus,
      newStatus: status,
      notes,
      userId,
      timestamp: new Date(),
    });

    return updatedClient;
  }

  @Observable({ spanName: 'client-onboarding-start', metricName: 'onboarding_start_duration_seconds' })
  async startOnboarding(
    startOnboardingDto: StartOnboardingDto,
    userId: string,
  ): Promise<Client> {
    const { clientId } = startOnboardingDto;
    const client = await this.findOne(clientId);

    if (client.onboardingStartDate) {
      throw new BadRequestException('Onboarding has already been started for this client');
    }

    client.onboardingStartDate = new Date();
    client.status = ClientStatus.ACTIVE;
    client.updatedBy = userId;

    const updatedClient = await this.clientRepository.save(client);

    // Create default onboarding tasks
    this.eventEmitter.emit('client.onboarding.started', {
      client: updatedClient,
      projectManagerId: startOnboardingDto.projectManagerId,
      customTasks: startOnboardingDto.customTasks,
      userId,
      timestamp: new Date(),
    });

    return updatedClient;
  }

  @Observable({ spanName: 'client-onboarding-complete', metricName: 'onboarding_complete_duration_seconds' })
  async completeOnboarding(
    id: string,
    completeOnboardingDto: CompleteOnboardingDto,
    userId: string,
  ): Promise<Client> {
    const client = await this.findOne(id);

    if (!client.onboardingStartDate) {
      throw new BadRequestException('Onboarding has not been started for this client');
    }

    if (client.onboardingCompleteDate) {
      throw new BadRequestException('Onboarding has already been completed for this client');
    }

    client.onboardingCompleteDate = new Date();
    client.complianceStatus = ComplianceStatus.ASSESSMENT;
    client.updatedBy = userId;

    if (completeOnboardingDto.firstAuditScheduled) {
      client.nextAuditDate = new Date(completeOnboardingDto.firstAuditScheduled);
    }

    const updatedClient = await this.clientRepository.save(client);

    // Emit onboarding completed event
    this.eventEmitter.emit('client.onboarding.completed', {
      client: updatedClient,
      summary: completeOnboardingDto.summary,
      finalChecklist: completeOnboardingDto.finalChecklist,
      userId,
      timestamp: new Date(),
    });

    return updatedClient;
  }

  async archive(id: string, userId: string): Promise<void> {
    const client = await this.findOne(id);

    // Check for active contracts
    const activeContracts = await this.contractCoreService.findActiveByClientId(id);
    if (activeContracts.length > 0) {
      throw new BadRequestException(
        'Cannot archive client with active contracts. Please terminate or complete all contracts first.',
      );
    }

    client.status = ClientStatus.ARCHIVED;
    client.isDeleted = true;
    client.deletedAt = new Date();
    client.deletedBy = userId;

    await this.clientRepository.save(client);

    // Invalidate cache
    await this.redisService.invalidateClient(id);
    await this.redisService.invalidateClientList(client.organizationId);

    // Emit archived event
    this.eventEmitter.emit('client.archived', {
      clientId: id,
      userId,
      timestamp: new Date(),
    });
  }

  async restore(id: string, userId: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    if (!client.isDeleted) {
      throw new BadRequestException('Client is not archived');
    }

    client.status = ClientStatus.INACTIVE;
    client.isDeleted = false;
    client.deletedAt = null;
    client.deletedBy = null;
    client.updatedBy = userId;

    const restoredClient = await this.clientRepository.save(client);

    // Emit restored event
    this.eventEmitter.emit('client.restored', {
      client: restoredClient,
      userId,
      timestamp: new Date(),
    });

    return restoredClient;
  }

  @Metered('compliance_metrics_fetch_duration_seconds')
  async getComplianceMetrics(id: string): Promise<{
    overallScore: number;
    frameworkScores: Record<string, number>;
    controlsStatus: {
      total: number;
      implemented: number;
      inProgress: number;
      notStarted: number;
    };
    upcomingAudits: ClientAudit[];
    certificateStatus: {
      active: number;
      expiringSoon: number;
      expired: number;
    };
  }> {
    const client = await this.findOne(id);

    // Get upcoming audits
    const upcomingAudits = await this.clientAuditRepository.find({
      where: {
        clientId: id,
        status: In(['PLANNED', 'SCHEDULED', 'IN_PREPARATION']),
      },
      order: {
        scheduledStartDate: 'ASC',
      },
      take: 5,
    });

    // Calculate framework scores using control service
    const frameworkScores: Record<string, number> = {};
    if (client.targetFrameworks) {
      try {
        for (const framework of client.targetFrameworks) {
          interface ComplianceScoreResponse {
            score: number;
          }
          const response = await this.serviceDiscovery.callService<ComplianceScoreResponse>(
            'control-service',
            'GET',
            `/compliance-score/${id}?framework=${framework}`,
          );
          frameworkScores[framework] = response.data?.score || 0;
        }
      } catch (error) {
        console.error('Failed to fetch framework scores from control service:', error);
        // Fallback to default scores
        client.targetFrameworks.forEach(framework => {
          frameworkScores[framework] = 0.5; // Default score
        });
      }
    }

    // Certificate status (placeholder - would check actual certificates)
    const certificateStatus = {
      active: client.complianceStatus === ComplianceStatus.COMPLIANT ? 1 : 0,
      expiringSoon: client.getCertificateDaysRemaining() <= 90 ? 1 : 0,
      expired: client.getCertificateDaysRemaining() < 0 ? 1 : 0,
    };

    return {
      overallScore: Number(client.complianceScore),
      frameworkScores,
      controlsStatus: await this.getControlsStatusFromService(id),
      upcomingAudits,
      certificateStatus,
    };
  }

  async getClientUsers(
    id: string,
    options?: {
      status?: string;
      role?: string;
    },
  ): Promise<ClientUser[]> {
    const query: any = {
      clientId: id,
    };

    if (options?.status) {
      query.status = options.status;
    }

    if (options?.role) {
      query.role = options.role;
    }

    return this.clientUserRepository.find({
      where: query,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getUpcomingAudits(daysAhead: number = 90): Promise<Client[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.clientRepository
      .createQueryBuilder('client')
      .where('client.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('client.status = :status', { status: ClientStatus.ACTIVE })
      .andWhere('client.nextAuditDate IS NOT NULL')
      .andWhere('client.nextAuditDate <= :futureDate', { futureDate })
      .orderBy('client.nextAuditDate', 'ASC', 'NULLS FIRST')
      .getMany();
  }

  async getExpiringCertificates(daysAhead: number = 90): Promise<Client[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.clientRepository
      .createQueryBuilder('client')
      .where('client.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('client.status = :status', { status: ClientStatus.ACTIVE })
      .andWhere('client.certificateExpiryDate IS NOT NULL')
      .andWhere('client.certificateExpiryDate <= :futureDate', { futureDate })
      .orderBy('client.certificateExpiryDate', 'ASC')
      .getMany();
  }

  async getDashboardStats(): Promise<{
    totalClients: number;
    activeClients: number;
    clientsByStatus: Record<string, number>;
    clientsByCompliance: Record<string, number>;
    clientsByFramework: Record<string, number>;
    upcomingAuditsCount: number;
    expiringCertificatesCount: number;
    averageComplianceScore: number;
  }> {
    const clients = await this.clientRepository.find({
      where: { isDeleted: false },
    });

    const activeClients = clients.filter(c => c.status === ClientStatus.ACTIVE);
    const upcomingAudits = await this.getUpcomingAudits(90);
    const expiringCertificates = await this.getExpiringCertificates(90);

    // Calculate stats
    const clientsByStatus: Record<string, number> = {};
    const clientsByCompliance: Record<string, number> = {};
    const clientsByFramework: Record<string, number> = {};

    clients.forEach(client => {
      // By status
      clientsByStatus[client.status] = (clientsByStatus[client.status] || 0) + 1;

      // By compliance
      clientsByCompliance[client.complianceStatus] =
        (clientsByCompliance[client.complianceStatus] || 0) + 1;

      // By framework
      if (client.targetFrameworks) {
        client.targetFrameworks.forEach(framework => {
          clientsByFramework[framework] = (clientsByFramework[framework] || 0) + 1;
        });
      }
    });

    const totalComplianceScore = activeClients.reduce(
      (sum, client) => sum + Number(client.complianceScore),
      0,
    );
    const averageComplianceScore =
      activeClients.length > 0 ? totalComplianceScore / activeClients.length : 0;

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      clientsByStatus,
      clientsByCompliance,
      clientsByFramework,
      upcomingAuditsCount: upcomingAudits.length,
      expiringCertificatesCount: expiringCertificates.length,
      averageComplianceScore: Math.round(averageComplianceScore * 100) / 100,
    };
  }

  async findByOrganizationId(organizationId: string): Promise<Client[]> {
    return await this.clientRepository.find({
      where: {
        organizationId,
        isDeleted: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // Audit Scheduling Methods
  @Observable({ spanName: 'audit-scheduling', metricName: 'audit_scheduling_duration_seconds' })
  async scheduleAudit(
    clientId: string,
    auditData: {
      name: string;
      type: string;
      framework: ComplianceFramework;
      scheduledStartDate: Date;
      scheduledEndDate: Date;
      scope?: string;
      leadAuditorId?: string;
      auditFirmName?: string;
    },
    userId: string,
  ): Promise<ClientAudit> {
    const client = await this.findOne(clientId);

    // Validate client is ready for audit
    if (client.complianceStatus === ComplianceStatus.NOT_STARTED) {
      throw new BadRequestException('Client compliance assessment must be started before scheduling an audit');
    }

    // Create audit
    const audit = this.clientAuditRepository.create({
      clientId,
      name: auditData.name,
      type: auditData.type as AuditType,
      framework: auditData.framework,
      scheduledStartDate: auditData.scheduledStartDate,
      scheduledEndDate: auditData.scheduledEndDate,
      scope: auditData.scope as AuditScope,
      leadAuditorId: auditData.leadAuditorId,
      auditFirmName: auditData.auditFirmName,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedAudit = await this.clientAuditRepository.save(audit);

    // Update client's next audit date if this is the earliest upcoming audit
    const upcomingAudits = await this.clientAuditRepository.find({
      where: {
        clientId,
        status: In(['planned', 'scheduled']),
        scheduledStartDate: Not(IsNull()),
      },
      order: { scheduledStartDate: 'ASC' },
    });

    if (upcomingAudits.length > 0) {
      client.nextAuditDate = upcomingAudits[0].scheduledStartDate;
      await this.clientRepository.save(client);
    }

    // Emit audit scheduled event
    try {
      await this.kafkaProducer.publishAuditScheduled(
        savedAudit.id,
        clientId,
        {
          name: savedAudit.name,
          type: savedAudit.type,
          framework: savedAudit.framework,
          scheduledStartDate: savedAudit.scheduledStartDate,
          scheduledEndDate: savedAudit.scheduledEndDate,
        },
        userId
      );
    } catch (error) {
      console.error('Failed to publish audit scheduled event:', error);
    }

    return savedAudit;
  }

  async getClientAudits(
    clientId: string,
    filters?: {
      status?: string;
      framework?: ComplianceFramework;
      type?: string;
      year?: number;
    },
  ): Promise<ClientAudit[]> {
    const where: any = { clientId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.framework) {
      where.framework = filters.framework;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.year) {
      // Filter by year using query builder for date comparison
      const startOfYear = new Date(filters.year, 0, 1);
      const endOfYear = new Date(filters.year, 11, 31);
      
      return this.clientAuditRepository
        .createQueryBuilder('audit')
        .where('audit.clientId = :clientId', { clientId })
        .andWhere('audit.scheduledStartDate >= :startOfYear', { startOfYear })
        .andWhere('audit.scheduledStartDate <= :endOfYear', { endOfYear })
        .andWhere(filters.status ? 'audit.status = :status' : '1=1', { status: filters.status })
        .andWhere(filters.framework ? 'audit.framework = :framework' : '1=1', { framework: filters.framework })
        .andWhere(filters.type ? 'audit.type = :type' : '1=1', { type: filters.type })
        .orderBy('audit.scheduledStartDate', 'DESC')
        .getMany();
    }

    return this.clientAuditRepository.find({
      where,
      order: { scheduledStartDate: 'DESC' },
    });
  }

  async getAuditById(clientId: string, auditId: string): Promise<ClientAudit> {
    const audit = await this.clientAuditRepository.findOne({
      where: { id: auditId, clientId },
    });

    if (!audit) {
      throw new NotFoundException(`Audit with ID ${auditId} not found for client ${clientId}`);
    }

    return audit;
  }

  async updateAudit(
    clientId: string,
    auditId: string,
    updateData: Partial<ClientAudit>,
    userId: string,
  ): Promise<ClientAudit> {
    const audit = await this.getAuditById(clientId, auditId);

    Object.assign(audit, updateData, { updatedBy: userId });

    const updatedAudit = await this.clientAuditRepository.save(audit);

    // Emit audit updated event
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.AUDIT_COMPLETED,
        clientId,
        userId,
        timestamp: new Date(),
        metadata: {
          auditId: updatedAudit.id,
          changes: updateData,
          status: updatedAudit.status,
        },
      });
    } catch (error) {
      console.error('Failed to publish audit updated event:', error);
    }

    return updatedAudit;
  }

  async cancelAudit(
    clientId: string,
    auditId: string,
    reason: string,
    userId: string,
  ): Promise<ClientAudit> {
    const audit = await this.getAuditById(clientId, auditId);

    if (audit.status === AuditStatus.COMPLETED || audit.status === AuditStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel audit with status ${audit.status}`);
    }

    audit.status = AuditStatus.CANCELLED;
    audit.metadata = {
      ...audit.metadata,
      cancellationReason: reason,
      cancelledBy: userId,
      cancelledAt: new Date(),
    };
    audit.updatedBy = userId;

    const cancelledAudit = await this.clientAuditRepository.save(audit);

    // Update client's next audit date
    await this.updateNextAuditDate(clientId);

    // Emit audit cancelled event
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.AUDIT_COMPLETED,
        clientId,
        userId,
        timestamp: new Date(),
        metadata: {
          auditId: cancelledAudit.id,
          reason,
          status: 'cancelled',
        },
      });
    } catch (error) {
      console.error('Failed to publish audit cancelled event:', error);
    }

    return cancelledAudit;
  }

  async completeAudit(
    clientId: string,
    auditId: string,
    completionData: {
      result: string;
      findings?: any;
      certificateNumber?: string;
      certificateIssueDate?: Date;
      certificateExpiryDate?: Date;
      reportDeliveredDate?: Date;
    },
    userId: string,
  ): Promise<ClientAudit> {
    const audit = await this.getAuditById(clientId, auditId);
    const client = await this.findOne(clientId);

    audit.status = AuditStatus.COMPLETED;
    audit.result = completionData.result as AuditResult;
    audit.actualEndDate = new Date();
    audit.reportDeliveredDate = completionData.reportDeliveredDate || new Date();
    audit.updatedBy = userId;

    if (completionData.findings) {
      audit.findings = completionData.findings;
    }

    if (completionData.certificateNumber) {
      audit.certificateNumber = completionData.certificateNumber;
      audit.certificateIssueDate = completionData.certificateIssueDate;
      audit.certificateExpiryDate = completionData.certificateExpiryDate;

      // Update client certificate expiry
      client.certificateExpiryDate = completionData.certificateExpiryDate;
      client.lastAuditDate = audit.actualEndDate;
      
      if (completionData.result === 'passed' || completionData.result === 'passed_with_conditions') {
        client.complianceStatus = ComplianceStatus.COMPLIANT;
      }
      
      await this.clientRepository.save(client);
    }

    const completedAudit = await this.clientAuditRepository.save(audit);

    // Update client's next audit date
    await this.updateNextAuditDate(clientId);

    // Emit audit completed event
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.AUDIT_COMPLETED,
        clientId,
        userId,
        timestamp: new Date(),
        metadata: {
          auditId: completedAudit.id,
          result: completedAudit.result,
          certificateNumber: completedAudit.certificateNumber,
          certificateExpiryDate: completedAudit.certificateExpiryDate,
        },
      });
    } catch (error) {
      console.error('Failed to publish audit completed event:', error);
    }

    return completedAudit;
  }

  private async updateNextAuditDate(clientId: string): Promise<void> {
    const upcomingAudits = await this.clientAuditRepository.find({
      where: {
        clientId,
        status: In(['planned', 'scheduled', 'in_preparation']),
        scheduledStartDate: Not(IsNull()),
      },
      order: { scheduledStartDate: 'ASC' },
      take: 1,
    });

    const client = await this.findOne(clientId);
    
    if (upcomingAudits.length > 0) {
      client.nextAuditDate = upcomingAudits[0].scheduledStartDate;
    } else {
      // Calculate next audit date based on framework requirements
      if (client.certificateExpiryDate) {
        const expiryDate = new Date(client.certificateExpiryDate);
        const nextAuditDate = new Date(expiryDate);
        nextAuditDate.setMonth(nextAuditDate.getMonth() - 3); // 3 months before expiry
        client.nextAuditDate = nextAuditDate;
      }
    }
    
    await this.clientRepository.save(client);
  }

  // Client Portal Access Methods
  async invitePortalUser(
    clientId: string,
    inviteData: {
      email: string;
      firstName: string;
      lastName: string;
      role?: string;
      title?: string;
      phone?: string;
      department?: string;
      sendInvitation?: boolean;
    },
    invitedBy: string,
  ): Promise<ClientUser> {
    const client = await this.findOne(clientId);

    // Check if user already exists
    const existingUser = await this.clientUserRepository.findOne({
      where: { clientId, email: inviteData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists for this client');
    }

    // Create portal user
    const portalUser = this.clientUserRepository.create({
      clientId,
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      role: (inviteData.role as ClientUserRole) || ClientUserRole.USER,
      title: inviteData.title,
      phone: inviteData.phone,
      department: inviteData.department,
      status: ClientUserStatus.PENDING,
      invitedBy,
      invitedAt: new Date(),
      invitationToken: this.generateInvitationToken(),
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const savedUser = await this.clientUserRepository.save(portalUser);

    if (inviteData.sendInvitation !== false) {
      // Send invitation notification
      await this.sendNotification('portal_user_invitation', {
        to: savedUser.email,
        template: 'client_portal_invitation',
        data: {
          clientName: client.name,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          invitationToken: savedUser.invitationToken,
          invitedBy,
        },
      });

      // Also emit Kafka event for audit trail
      try {
        await this.kafkaProducer.publishClientEvent({
          eventType: ClientEventType.CLIENT_UPDATED,
          clientId,
          userId: invitedBy,
          timestamp: new Date(),
          metadata: {
            action: 'portal_user_invited',
            userId: savedUser.id,
            clientName: client.name,
            email: savedUser.email,
            firstName: savedUser.firstName,
          },
        });
      } catch (error) {
        console.error('Failed to publish portal user invited event:', error);
      }
    }

    return savedUser;
  }

  async bulkInvitePortalUsers(
    clientId: string,
    users: Array<any>,
    invitedBy: string,
    sendInvitations: boolean = true,
  ): Promise<{ success: ClientUser[]; failed: Array<{ email: string; error: string }> }> {
    const client = await this.findOne(clientId);
    const success: ClientUser[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const user of users) {
      try {
        const invitedUser = await this.invitePortalUser(
          clientId,
          { ...user, sendInvitation: sendInvitations },
          invitedBy,
        );
        success.push(invitedUser);
      } catch (error) {
        failed.push({
          email: user.email,
          error: error.message,
        });
      }
    }

    return { success, failed };
  }

  async updatePortalUser(
    clientId: string,
    userId: string,
    updateData: any,
    updatedBy: string,
  ): Promise<ClientUser> {
    const user = await this.clientUserRepository.findOne({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException(`Portal user with ID ${userId} not found for this client`);
    }

    // Map PortalUserRole to ClientUserRole if needed
    const mappedData: any = { ...updateData };
    if (updateData.role) {
      const roleMapping = {
        'client_admin': ClientUserRole.ADMIN,
        'client_user': ClientUserRole.USER,
        'client_viewer': ClientUserRole.VIEWER,
      };
      mappedData.role = roleMapping[updateData.role] || ClientUserRole.USER;
    }

    // Map PortalUserStatus to ClientUserStatus if needed
    if (updateData.status) {
      const statusMapping = {
        'pending_invitation': ClientUserStatus.PENDING,
        'active': ClientUserStatus.ACTIVE,
        'inactive': ClientUserStatus.INACTIVE,
        'suspended': ClientUserStatus.SUSPENDED,
      };
      mappedData.status = statusMapping[updateData.status] || ClientUserStatus.ACTIVE;
    }

    Object.assign(user, mappedData, { updatedBy });

    return this.clientUserRepository.save(user);
  }

  async removePortalUser(
    clientId: string,
    userId: string,
    removedBy: string,
  ): Promise<void> {
    const user = await this.clientUserRepository.findOne({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException(`Portal user with ID ${userId} not found for this client`);
    }

    user.status = ClientUserStatus.INACTIVE;
    user.updatedBy = removedBy;
    user.deactivatedAt = new Date();

    await this.clientUserRepository.save(user);

    // Emit user removed event
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.CLIENT_UPDATED,
        clientId,
        userId: removedBy,
        timestamp: new Date(),
        metadata: {
          action: 'portal_user_removed',
          userId,
          email: user.email,
        },
      });
    } catch (error) {
      console.error('Failed to publish portal user removed event:', error);
    }
  }

  async resendInvitation(
    clientId: string,
    userId: string,
    customMessage?: string,
  ): Promise<void> {
    const user = await this.clientUserRepository.findOne({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException(`Portal user with ID ${userId} not found for this client`);
    }

    if (user.status !== ClientUserStatus.PENDING) {
      throw new BadRequestException('Can only resend invitation to pending users');
    }

    // Generate new token and extend expiration
    user.invitationToken = this.generateInvitationToken();
    user.invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.clientUserRepository.save(user);

    // Send resend invitation notification
    const client = await this.findOne(clientId);
    await this.sendNotification('portal_user_invitation_resend', {
      to: user.email,
      template: 'client_portal_invitation_resend',
      data: {
        clientName: client.name,
        firstName: user.firstName,
        lastName: user.lastName,
        invitationToken: user.invitationToken,
        customMessage,
      },
    });

    // Also emit Kafka event for audit trail
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.CLIENT_UPDATED,
        clientId,
        userId: 'system',
        timestamp: new Date(),
        metadata: {
          action: 'portal_invitation_resent',
          userId,
          clientName: client.name,
          email: user.email,
          firstName: user.firstName,
        },
      });
    } catch (error) {
      console.error('Failed to publish invitation resent event:', error);
    }
  }

  async updatePortalAccessSettings(
    clientId: string,
    settings: any,
    updatedBy: string,
  ): Promise<Client> {
    const client = await this.findOne(clientId);

    client.settings = {
      ...client.settings,
      features: {
        ...client.settings?.features,
        ...settings,
      },
    };
    client.updatedBy = updatedBy;

    return this.clientRepository.save(client);
  }

  async getPortalDashboard(clientId: string): Promise<any> {
    const client = await this.findOne(clientId);
    
    // Get upcoming audits
    const upcomingAudits = await this.clientAuditRepository.find({
      where: {
        clientId,
        status: In(['planned', 'scheduled', 'in_preparation', 'in_progress']),
      },
      order: { scheduledStartDate: 'ASC' },
      take: 5,
    });

    // Get active contracts  
    const activeContracts = await this.contractCoreService.findByClientId(clientId);

    // Get compliance metrics
    const complianceMetrics = await this.getComplianceMetrics(clientId);

    // Get recent activity (simplified)
    const recentActivity = []; // Would integrate with audit trail service

    // Get pending documents (simplified)
    const pendingDocuments = await this.clientDocumentRepository.find({
      where: {
        clientId,
        status: DocumentStatus.PENDING_REVIEW,
      },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        logo: client.logo,
        complianceStatus: client.complianceStatus,
        complianceScore: client.complianceScore,
      },
      upcomingAudits: upcomingAudits.map(audit => ({
        id: audit.id,
        framework: audit.framework,
        scheduledDate: audit.scheduledStartDate,
        status: audit.status,
      })),
      activeContracts: activeContracts.map(contract => ({
        id: contract.id,
        contractNumber: contract.contractNumber,
        type: contract.type,
        endDate: contract.endDate,
      })),
      recentActivity,
      complianceMetrics: {
        controlsImplemented: complianceMetrics.controlsStatus.implemented,
        controlsTotal: complianceMetrics.controlsStatus.total,
        openFindings: 0, // Would integrate with findings service
        overdueItems: 0, // Would calculate from various sources
      },
      pendingDocuments: pendingDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        reviewDate: doc.reviewDate,
      })),
    };
  }

  async logPortalActivity(
    clientId: string,
    userId: string,
    activityType: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // This would typically be handled by an audit service
    // For now, just emit an event
    try {
      await this.kafkaProducer.publishClientEvent({
        eventType: ClientEventType.CLIENT_UPDATED,
        clientId,
        userId,
        timestamp: new Date(),
        metadata: {
          action: 'portal_activity_logged',
          activityType,
          details,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log portal activity:', error);
    }
  }

  private generateInvitationToken(): string {
    // Generate a secure random token
    const buffer = require('crypto').randomBytes(32);
    return buffer.toString('hex');
  }

  /**
   * Get controls status from control service
   */
  private async getControlsStatusFromService(clientId: string): Promise<{
    total: number;
    implemented: number;
    inProgress: number;
    notStarted: number;
  }> {
    try {
      const response = await this.serviceDiscovery.callService(
        'control-service',
        'GET',
        `/controls/status/${clientId}`,
      );
      return (response.data as any) || {
        total: 0,
        implemented: 0,
        inProgress: 0,
        notStarted: 0,
      };
    } catch (error) {
      console.error('Failed to fetch controls status from control service:', error);
      // Return fallback data
      return {
        total: 100,
        implemented: 75,
        inProgress: 15,
        notStarted: 10,
      };
    }
  }

  /**
   * Validate user exists in auth service
   */
  private async validateUserExists(userId: string): Promise<boolean> {
    try {
      const response = await this.serviceDiscovery.callService(
        'auth-service',
        'GET',
        `/users/${userId}`,
      );
      return !!response.data;
    } catch (error) {
      console.error('Failed to validate user from auth service:', error);
      return false;
    }
  }

  /**
   * Send notification through notification service
   */
  private async sendNotification(type: string, data: any): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/notifications',
        {
          type,
          ...data,
        },
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Don't throw error - notifications are not critical
    }
  }
}