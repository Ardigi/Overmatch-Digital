import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Like, Repository } from 'typeorm';
import type { CreateSOCAuditDto } from './dto/create-soc-audit.dto';
import type { UpdateSOCAuditDto } from './dto/update-soc-audit.dto';
import {
  AuditPhase,
  AuditStatus,
  type AuditType,
  SOCAudit,
} from './entities/soc-audit.entity';

@Injectable()
export class SOCAuditsService {
  constructor(
    @InjectRepository(SOCAudit)
    private readonly auditRepository: Repository<SOCAudit>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    createAuditDto: CreateSOCAuditDto,
    userId: string,
  ): Promise<SOCAudit> {
    // Check if audit number already exists
    const existing = await this.auditRepository.findOne({
      where: { auditNumber: createAuditDto.auditNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Audit with number ${createAuditDto.auditNumber} already exists`,
      );
    }

    // Validate audit period
    if (createAuditDto.auditPeriodEnd <= createAuditDto.auditPeriodStart) {
      throw new BadRequestException(
        'Audit period end date must be after start date',
      );
    }

    const audit = this.auditRepository.create({
      ...createAuditDto,
      status: AuditStatus.PLANNING,
      currentPhase: AuditPhase.KICKOFF,
      completionPercentage: 0,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedAudit = await this.auditRepository.save(audit);

    // Emit audit created event
    this.eventEmitter.emit('soc-audit.created', {
      audit: savedAudit,
      userId,
      timestamp: new Date(),
    });

    return savedAudit;
  }

  async findAll(params: {
    clientId?: string;
    organizationId?: string;
    status?: AuditStatus;
    auditType?: AuditType;
    leadAuditorId?: string;
    cpaFirmId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    data: SOCAudit[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      clientId,
      organizationId,
      status,
      auditType,
      leadAuditorId,
      cpaFirmId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;

    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    if (clientId) {
      queryBuilder.andWhere('audit.clientId = :clientId', { clientId });
    }

    if (organizationId) {
      queryBuilder.andWhere('audit.organizationId = :organizationId', {
        organizationId,
      });
    }

    if (status) {
      queryBuilder.andWhere('audit.status = :status', { status });
    }

    if (auditType) {
      queryBuilder.andWhere('audit.auditType = :auditType', { auditType });
    }

    if (leadAuditorId) {
      queryBuilder.andWhere('audit.leadAuditorId = :leadAuditorId', {
        leadAuditorId,
      });
    }

    if (cpaFirmId) {
      queryBuilder.andWhere('audit.cpaFirmId = :cpaFirmId', { cpaFirmId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(audit.auditNumber ILIKE :search OR audit.scopeDescription ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'audit.auditPeriodStart BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

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

  async findOne(id: string): Promise<SOCAudit> {
    const audit = await this.auditRepository.findOne({
      where: { id },
    });

    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    return audit;
  }

  async update(
    id: string,
    updateAuditDto: UpdateSOCAuditDto,
    userId: string,
  ): Promise<SOCAudit> {
    const audit = await this.findOne(id);

    // Track status changes
    const previousStatus = audit.status;
    const previousPhase = audit.currentPhase;

    Object.assign(audit, {
      ...updateAuditDto,
      updatedBy: userId,
    });

    const updatedAudit = await this.auditRepository.save(audit);

    // Emit events for significant changes
    if (previousStatus !== updatedAudit.status) {
      this.eventEmitter.emit('soc-audit.status-changed', {
        audit: updatedAudit,
        previousStatus,
        newStatus: updatedAudit.status,
        userId,
        timestamp: new Date(),
      });
    }

    if (previousPhase !== updatedAudit.currentPhase) {
      this.eventEmitter.emit('soc-audit.phase-changed', {
        audit: updatedAudit,
        previousPhase,
        newPhase: updatedAudit.currentPhase,
        userId,
        timestamp: new Date(),
      });
    }

    return updatedAudit;
  }

  async updateStatus(
    id: string,
    status: AuditStatus,
    userId: string,
  ): Promise<SOCAudit> {
    const audit = await this.findOne(id);
    const previousStatus = audit.status;

    // Validate status transitions
    if (!this.isValidStatusTransition(previousStatus, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${previousStatus} to ${status}`,
      );
    }

    audit.status = status;
    audit.updatedBy = userId;

    // Update completion date if completed
    if (status === AuditStatus.COMPLETED) {
      audit.actualCompletionDate = new Date();
      audit.completionPercentage = 100;
    }

    const updatedAudit = await this.auditRepository.save(audit);

    this.eventEmitter.emit('soc-audit.status-changed', {
      audit: updatedAudit,
      previousStatus,
      newStatus: status,
      userId,
      timestamp: new Date(),
    });

    return updatedAudit;
  }

  async updatePhase(
    id: string,
    phase: AuditPhase,
    userId: string,
  ): Promise<SOCAudit> {
    const audit = await this.findOne(id);
    const previousPhase = audit.currentPhase;

    audit.currentPhase = phase;
    audit.updatedBy = userId;

    // Update completion percentage based on phase
    audit.completionPercentage = this.calculatePhaseProgress(phase);

    const updatedAudit = await this.auditRepository.save(audit);

    this.eventEmitter.emit('soc-audit.phase-changed', {
      audit: updatedAudit,
      previousPhase,
      newPhase: phase,
      userId,
      timestamp: new Date(),
    });

    return updatedAudit;
  }

  async getAuditMetrics(id: string): Promise<{
    controlTestingProgress: {
      total: number;
      tested: number;
      effective: number;
      deficient: number;
      percentage: number;
    };
    findingsBreakdown: {
      total: number;
      bySeverity: Record<string, number>;
      remediated: number;
      remediationRate: number;
    };
    timelineMetrics: {
      daysInAudit: number;
      daysRemaining: number;
      isOnSchedule: boolean;
      estimatedCompletionDate: Date;
    };
    budgetMetrics: {
      hoursUtilization: number;
      costUtilization: number;
      projectedOverrun: number;
    };
  }> {
    const audit = await this.findOne(id);

    // Control testing progress
    const controlTestingProgress = {
      total: audit.totalControls,
      tested: audit.testedControls,
      effective: audit.effectiveControls,
      deficient: audit.deficientControls,
      percentage:
        audit.totalControls > 0
          ? (audit.testedControls / audit.totalControls) * 100
          : 0,
    };

    // Findings breakdown
    const findingsBreakdown = {
      total: audit.totalFindings,
      bySeverity: {
        critical: audit.criticalFindings,
        major: audit.majorFindings,
        minor: audit.minorFindings,
      },
      remediated: audit.remediatedFindings,
      remediationRate:
        audit.totalFindings > 0
          ? (audit.remediatedFindings / audit.totalFindings) * 100
          : 0,
    };

    // Timeline metrics
    const startDate = new Date(audit.auditPeriodStart);
    const today = new Date();
    const daysInAudit = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const plannedEnd = audit.plannedCompletionDate
      ? new Date(audit.plannedCompletionDate)
      : new Date(audit.auditPeriodEnd);
    const daysRemaining = Math.floor(
      (plannedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const timelineMetrics = {
      daysInAudit,
      daysRemaining,
      isOnSchedule: daysRemaining >= 0 && audit.completionPercentage >= 50,
      estimatedCompletionDate: plannedEnd,
    };

    // Budget metrics
    const budgetMetrics = {
      hoursUtilization: audit.budgetedHours
        ? (audit.actualHours / audit.budgetedHours) * 100
        : 0,
      costUtilization: audit.budgetedCost
        ? (audit.actualCost / audit.budgetedCost) * 100
        : 0,
      projectedOverrun:
        audit.budgetedCost && audit.actualCost > audit.budgetedCost * 0.8
          ? audit.actualCost * 1.2 - audit.budgetedCost
          : 0,
    };

    return {
      controlTestingProgress,
      findingsBreakdown,
      timelineMetrics,
      budgetMetrics,
    };
  }

  async getUpcomingAudits(
    organizationId: string,
    days: number = 30,
  ): Promise<SOCAudit[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.auditRepository.find({
      where: {
        organizationId,
        status: In([AuditStatus.PLANNING, AuditStatus.IN_FIELDWORK]),
        plannedCompletionDate: Between(new Date(), futureDate),
      },
      order: {
        plannedCompletionDate: 'ASC',
      },
    });
  }

  async getAuditsByClient(clientId: string): Promise<SOCAudit[]> {
    return this.auditRepository.find({
      where: { clientId },
      order: {
        auditPeriodStart: 'DESC',
      },
    });
  }

  async archive(id: string, userId: string): Promise<SOCAudit> {
    const audit = await this.findOne(id);

    if (audit.status !== AuditStatus.COMPLETED) {
      throw new BadRequestException(
        'Only completed audits can be archived',
      );
    }

    audit.isArchived = true;
    audit.archiveDate = new Date();
    audit.updatedBy = userId;

    const archivedAudit = await this.auditRepository.save(audit);

    this.eventEmitter.emit('soc-audit.archived', {
      audit: archivedAudit,
      userId,
      timestamp: new Date(),
    });

    return archivedAudit;
  }

  private isValidStatusTransition(
    currentStatus: AuditStatus,
    newStatus: AuditStatus,
  ): boolean {
    const validTransitions: Record<AuditStatus, AuditStatus[]> = {
      [AuditStatus.PLANNING]: [
        AuditStatus.IN_FIELDWORK,
        AuditStatus.ON_HOLD,
        AuditStatus.CANCELLED,
      ],
      [AuditStatus.IN_FIELDWORK]: [
        AuditStatus.REVIEW,
        AuditStatus.ON_HOLD,
        AuditStatus.CANCELLED,
      ],
      [AuditStatus.REVIEW]: [
        AuditStatus.DRAFT_REPORT,
        AuditStatus.IN_FIELDWORK,
        AuditStatus.ON_HOLD,
      ],
      [AuditStatus.DRAFT_REPORT]: [
        AuditStatus.FINAL_REVIEW,
        AuditStatus.REVIEW,
      ],
      [AuditStatus.FINAL_REVIEW]: [
        AuditStatus.COMPLETED,
        AuditStatus.DRAFT_REPORT,
      ],
      [AuditStatus.COMPLETED]: [],
      [AuditStatus.ON_HOLD]: [
        AuditStatus.PLANNING,
        AuditStatus.IN_FIELDWORK,
        AuditStatus.REVIEW,
        AuditStatus.CANCELLED,
      ],
      [AuditStatus.CANCELLED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private calculatePhaseProgress(phase: AuditPhase): number {
    const phaseProgress: Record<AuditPhase, number> = {
      [AuditPhase.KICKOFF]: 5,
      [AuditPhase.RISK_ASSESSMENT]: 15,
      [AuditPhase.CONTROL_DESIGN]: 25,
      [AuditPhase.CONTROL_TESTING]: 50,
      [AuditPhase.DEFICIENCY_REMEDIATION]: 70,
      [AuditPhase.REPORT_PREPARATION]: 85,
      [AuditPhase.QUALITY_REVIEW]: 95,
      [AuditPhase.ISSUANCE]: 100,
    };

    return phaseProgress[phase] || 0;
  }
}