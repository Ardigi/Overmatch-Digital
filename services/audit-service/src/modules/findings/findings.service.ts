import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AuditFindingCreatedEvent,
  type AuditFindingResolvedEvent,
  type AuditFindingUpdatedEvent,
  EventType,
} from '@soc-compliance/events';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { CreateAuditFindingDto } from '../soc-audits/dto/create-audit-finding.dto';
import { AuditFinding, FindingSeverity, FindingStatus } from '../soc-audits/entities/audit-finding.entity';

@Injectable()
export class FindingsService {
  private readonly logger = new Logger(FindingsService.name);

  /**
   * Maps FindingSeverity enum to event severity format
   */
  private mapSeverityToEventFormat(severity: FindingSeverity): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case FindingSeverity.CRITICAL:
        return 'critical';
      case FindingSeverity.HIGH:
        return 'high';
      case FindingSeverity.MEDIUM:
        return 'medium';
      case FindingSeverity.LOW:
      case FindingSeverity.OBSERVATION:
        return 'low';
      default:
        return 'low';
    }
  }

  constructor(
    @InjectRepository(AuditFinding)
    private readonly findingRepository: Repository<AuditFinding>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createDto: CreateAuditFindingDto & { createdBy: string; organizationId: string }): Promise<AuditFinding> {
    const finding = this.findingRepository.create({
      ...createDto,
      status: FindingStatus.IDENTIFIED,
      updatedBy: createDto.createdBy,
    });

    const savedFinding = await this.findingRepository.save(finding);

    // Emit standardized finding created event
    const findingCreatedEvent: AuditFindingCreatedEvent = {
      id: uuidv4(),
      type: EventType.AUDIT_FINDING_CREATED,
      timestamp: new Date(),
      version: '1.0',
      source: 'audit-service',
      userId: createDto.createdBy,
      organizationId: createDto.organizationId,
      payload: {
        findingId: savedFinding.id,
        auditId: savedFinding.auditId,
        controlId: savedFinding.controlId,
        controlCode: savedFinding.controlCode,
        severity: this.mapSeverityToEventFormat(savedFinding.severity),
        findingType: savedFinding.findingType,
        status: savedFinding.status,
        description: savedFinding.description,
        recommendation: savedFinding.recommendation,
      },
    };

    this.eventEmitter.emit('finding.created', findingCreatedEvent);
    this.logger.log(`Emitted finding.created event for finding ${savedFinding.id}`);

    return savedFinding;
  }

  async update(
    id: string,
    updateDto: Partial<AuditFinding> & { updatedBy: string; organizationId: string }
  ): Promise<AuditFinding> {
    const finding = await this.findingRepository.findOne({ where: { id } });
    if (!finding) {
      throw new NotFoundException(`Finding with ID ${id} not found`);
    }

    const previousStatus = finding.status;
    Object.assign(finding, updateDto);
    const updatedFinding = await this.findingRepository.save(finding);

    // Emit standardized finding updated event
    const findingUpdatedEvent: AuditFindingUpdatedEvent = {
      id: uuidv4(),
      type: EventType.AUDIT_FINDING_UPDATED,
      timestamp: new Date(),
      version: '1.0',
      source: 'audit-service',
      userId: updateDto.updatedBy,
      organizationId: updateDto.organizationId,
      payload: {
        findingId: updatedFinding.id,
        auditId: updatedFinding.auditId,
        controlId: updatedFinding.controlId,
        controlCode: updatedFinding.controlCode,
        severity: this.mapSeverityToEventFormat(updatedFinding.severity),
        status: updatedFinding.status,
        updatedBy: updateDto.updatedBy,
        changes: Object.keys(updateDto).filter(key => key !== 'updatedBy' && key !== 'organizationId').reduce((acc, key) => {
          acc[key] = { old: previousStatus, new: updateDto[key] };
          return acc;
        }, {} as Record<string, any>),
      },
    };

    this.eventEmitter.emit('finding.updated', findingUpdatedEvent);
    this.logger.log(`Emitted finding.updated event for finding ${updatedFinding.id}`);

    return updatedFinding;
  }

  async resolve(
    id: string,
    resolutionData: {
      remediationPlan?: string;
      remediationEvidence?: string;
      remediationValidatedBy: string;
      organizationId: string;
    }
  ): Promise<AuditFinding> {
    const finding = await this.findingRepository.findOne({ where: { id } });
    if (!finding) {
      throw new NotFoundException(`Finding with ID ${id} not found`);
    }

    // Update finding with resolution data
    finding.status = FindingStatus.REMEDIATED;
    finding.remediationCompleteDate = new Date();
    finding.remediationValidatedBy = resolutionData.remediationValidatedBy;
    finding.remediationValidationDate = new Date();
    finding.updatedBy = resolutionData.remediationValidatedBy;

    if (resolutionData.remediationPlan) {
      finding.remediationPlan = resolutionData.remediationPlan;
    }
    if (resolutionData.remediationEvidence) {
      finding.remediationEvidence = resolutionData.remediationEvidence;
    }

    const resolvedFinding = await this.findingRepository.save(finding);

    // Emit standardized finding resolved event
    const findingResolvedEvent: AuditFindingResolvedEvent = {
      id: uuidv4(),
      type: EventType.AUDIT_FINDING_RESOLVED,
      timestamp: new Date(),
      version: '1.0',
      source: 'audit-service',
      userId: resolutionData.remediationValidatedBy,
      organizationId: resolutionData.organizationId,
      payload: {
        findingId: resolvedFinding.id,
        auditId: resolvedFinding.auditId,
        controlId: resolvedFinding.controlId,
        controlCode: resolvedFinding.controlCode,
        resolvedBy: resolutionData.remediationValidatedBy,
        resolutionDate: resolvedFinding.remediationCompleteDate,
        resolutionNotes: resolutionData.remediationPlan,
        evidenceIds: resolutionData.remediationEvidence ? [resolutionData.remediationEvidence] : undefined,
      },
    };

    this.eventEmitter.emit('finding.resolved', findingResolvedEvent);
    this.logger.log(`Emitted finding.resolved event for finding ${resolvedFinding.id}`);

    return resolvedFinding;
  }

  async findOne(id: string): Promise<AuditFinding> {
    const finding = await this.findingRepository.findOne({ 
      where: { id },
      relations: ['audit']
    });
    
    if (!finding) {
      throw new NotFoundException(`Finding with ID ${id} not found`);
    }
    
    return finding;
  }

  async findByAudit(auditId: string): Promise<AuditFinding[]> {
    return this.findingRepository.find({
      where: { auditId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByControl(controlId: string): Promise<AuditFinding[]> {
    return this.findingRepository.find({
      where: { controlId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: string,
    status: FindingStatus,
    updatedBy: string,
    organizationId: string
  ): Promise<AuditFinding> {
    return this.update(id, { status, updatedBy, organizationId });
  }
}