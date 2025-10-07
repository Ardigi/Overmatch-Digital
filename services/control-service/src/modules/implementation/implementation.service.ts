import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type ControlAssignedEvent,
  type ControlImplementationUpdatedEvent,
  EventType,
} from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService } from '@soc-compliance/monitoring';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { KafkaService } from '../../kafka/kafka.service';
import { ControlsService } from '../controls/controls.service';
import type { CreateImplementationDto } from './dto/create-implementation.dto';
import type { UpdateImplementationDto } from './dto/update-implementation.dto';
import { UpdateDtoWithEvidence } from '../../shared/types/implementation-update.types';
import { Control } from '../controls/entities/control.entity';
import { ControlImplementation, ImplementationStatus } from './entities/control-implementation.entity';

@Injectable()
export class ImplementationService {
  constructor(
    @InjectRepository(ControlImplementation)
    private implementationRepository: Repository<ControlImplementation>,
    @InjectRepository(Control)
    private controlRepository: Repository<Control>,
    private controlsService: ControlsService,
    private kafkaService: KafkaService,
    private serviceDiscovery: ServiceDiscoveryService,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  /**
   * Type guard to check if DTO has evidence property
   */
  private hasEvidence(dto: UpdateImplementationDto): dto is UpdateDtoWithEvidence {
    return 'evidence' in dto && Array.isArray(dto.evidence);
  }

  async create(createImplementationDto: CreateImplementationDto): Promise<ControlImplementation> {
    // Validate control exists
    const control = await this.controlsService.findOne(createImplementationDto.controlId);

    const implementation = this.implementationRepository.create({
      ...createImplementationDto,
      status: ImplementationStatus.IN_PROGRESS,
    });

    const savedImplementation = await this.implementationRepository.save(implementation);

    // Emit control assigned event
    const controlAssignedEvent: ControlAssignedEvent = {
      id: uuidv4(),
      type: EventType.CONTROL_ASSIGNED,
      timestamp: new Date(),
      version: '1.0',
      source: 'control-service',
      userId: savedImplementation.implementedBy,
      organizationId: savedImplementation.organizationId,
      payload: {
        controlId: control.id,
        controlCode: control.code,
        organizationId: savedImplementation.organizationId,
        assignedBy: savedImplementation.implementedBy,
        framework: control.frameworks?.[0]?.name,
      },
    };
    
    this.eventEmitter.emit('control.assigned', controlAssignedEvent);
    this.loggingService.debug(`Emitted control.assigned event for control ${control.id}`);

    return savedImplementation;
  }

  async findAll(organizationId: string, filters?: any): Promise<ControlImplementation[]> {
    const query = this.implementationRepository
      .createQueryBuilder('implementation')
      .leftJoinAndSelect('implementation.control', 'control')
      .where('implementation.organizationId = :organizationId', { organizationId });

    if (filters?.controlId) {
      query.andWhere('implementation.controlId = :controlId', { controlId: filters.controlId });
    }

    if (filters?.status) {
      query.andWhere('implementation.status = :status', { status: filters.status });
    }

    if (filters?.maturityLevel) {
      query.andWhere('implementation.maturityLevel = :maturityLevel', { 
        maturityLevel: filters.maturityLevel 
      });
    }

    return query.orderBy('control.code', 'ASC').getMany();
  }

  async findOne(id: string): Promise<ControlImplementation> {
    const implementation = await this.implementationRepository.findOne({
      where: { id },
      relations: ['control'],
    });

    if (!implementation) {
      throw new NotFoundException(`Control implementation with ID ${id} not found`);
    }

    return implementation;
  }

  async update(
    id: string, 
    updateImplementationDto: UpdateImplementationDto
  ): Promise<ControlImplementation> {
    const implementation = await this.findOne(id);
    const previousStatus = implementation.status;

    // Add to change history
    if (updateImplementationDto.status || updateImplementationDto.configuration) {
      implementation.changeHistory = implementation.changeHistory || [];
      implementation.changeHistory.push({
        changeId: `CHG-${Date.now()}`,
        changeType: updateImplementationDto.status ? 'STATUS_CHANGE' : 'CONFIGURATION_UPDATE',
        description: `Status changed from ${previousStatus} to ${updateImplementationDto.status}`,
        changedBy: updateImplementationDto.implementedBy || implementation.implementedBy,
        changedAt: new Date(),
        impact: 'TBD',
      });
    }

    Object.assign(implementation, updateImplementationDto);

    // Update dates based on status
    if (updateImplementationDto.status === ImplementationStatus.IMPLEMENTED) {
      implementation.implementationDate = new Date();
    }

    const updatedImplementation = await this.implementationRepository.save(implementation);

    // Emit events based on status changes
    if (updateImplementationDto.status && updateImplementationDto.status !== previousStatus) {
      await this.emitStatusChangeEvent(updatedImplementation, previousStatus);
    }

    return updatedImplementation;
  }

  async addGap(id: string, gap: any): Promise<ControlImplementation> {
    const implementation = await this.findOne(id);

    implementation.gaps = implementation.gaps || [];
    implementation.gaps.push({
      ...gap,
      id: `GAP-${Date.now()}`,
      status: 'OPEN',
    });

    const updatedImplementation = await this.implementationRepository.save(implementation);

    await this.kafkaService.emit('control.gap.identified', {
      implementationId: implementation.id,
      controlId: implementation.controlId,
      gap,
    });

    return updatedImplementation;
  }

  async updateEffectiveness(
    id: string, 
    effectiveness: any
  ): Promise<ControlImplementation> {
    const implementation = await this.findOne(id);

    implementation.effectiveness = {
      ...effectiveness,
      lastAssessmentDate: new Date(),
    };

    const updatedImplementation = await this.implementationRepository.save(implementation);

    if (effectiveness.score < 70) {
      await this.kafkaService.emit('control.effectiveness.low', {
        implementationId: implementation.id,
        controlId: implementation.controlId,
        effectivenessScore: effectiveness.score,
      });
    }

    return updatedImplementation;
  }

  async getImplementationMetrics(organizationId: string): Promise<any> {
    const metrics = await this.implementationRepository.query(`
      SELECT 
        COUNT(*) as total_controls,
        COUNT(CASE WHEN status = 'IMPLEMENTED' THEN 1 END) as implemented,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'NOT_STARTED' THEN 1 END) as not_started,
        COUNT(CASE WHEN status = 'PARTIAL' THEN 1 END) as partial,
        AVG(CASE WHEN effectiveness->>'score' IS NOT NULL 
            THEN (effectiveness->>'score')::numeric END) as avg_effectiveness
      FROM control_implementations
      WHERE organization_id = $1
    `, [organizationId]);

    const maturityBreakdown = await this.implementationRepository.query(`
      SELECT 
        maturity_level,
        COUNT(*) as count
      FROM control_implementations
      WHERE organization_id = $1
      GROUP BY maturity_level
    `, [organizationId]);

    const gapAnalysis = await this.implementationRepository.query(`
      SELECT 
        COUNT(DISTINCT id) as implementations_with_gaps,
        SUM(jsonb_array_length(gaps)) as total_gaps,
        COUNT(DISTINCT id) FILTER (
          WHERE exists (
            SELECT 1 FROM jsonb_array_elements(gaps) gap 
            WHERE gap->>'status' = 'OPEN'
          )
        ) as implementations_with_open_gaps
      FROM control_implementations
      WHERE organization_id = $1
        AND jsonb_array_length(gaps) > 0
    `, [organizationId]);

    return {
      summary: metrics[0],
      implementationRate: (metrics[0].implemented / metrics[0].total_controls) * 100,
      maturityBreakdown,
      gapAnalysis: gapAnalysis[0],
    };
  }

  async scheduleReview(id: string, reviewDate: Date): Promise<ControlImplementation> {
    const implementation = await this.findOne(id);
    
    implementation.nextReviewDate = reviewDate;
    
    return await this.implementationRepository.save(implementation);
  }

  private async emitStatusChangeEvent(
    implementation: ControlImplementation,
    previousStatus: ImplementationStatus
  ) {
    // Emit standardized control implementation updated event
    const implementationUpdatedEvent: ControlImplementationUpdatedEvent = {
      id: uuidv4(),
      type: EventType.CONTROL_IMPLEMENTATION_UPDATED,
      timestamp: new Date(),
      version: '1.0',
      source: 'control-service',
      userId: implementation.implementedBy,
      organizationId: implementation.organizationId,
      payload: {
        controlId: implementation.controlId,
        controlCode: implementation.control?.code || implementation.controlId,
        organizationId: implementation.organizationId,
        previousStatus,
        newStatus: implementation.status,
        updatedBy: implementation.implementedBy,
        effectiveness: implementation.effectiveness ? {
          score: implementation.effectiveness.score || 0,
          strengths: implementation.effectiveness.strengths || [],
          weaknesses: implementation.effectiveness.weaknesses || [],
        } : undefined,
      },
    };
    
    this.eventEmitter.emit('control.implementation.updated', implementationUpdatedEvent);
    this.loggingService.debug(`Emitted control.implementation.updated event for control ${implementation.controlId}`);
  }

  // Inter-service communication methods

  /**
   * Get evidence for implementation from evidence-service
   */
  async getImplementationEvidence(implementationId: string): Promise<any> {
    try {
      const response = await this.serviceDiscovery.callService(
        'evidence-service',
        'GET',
        `/evidence?implementationId=${implementationId}`,
      );
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get evidence for implementation ${implementationId}`, error);
      return [];
    }
  }

  /**
   * Submit implementation for approval workflow
   */
  async submitForApproval(implementationId: string, approvalData: any): Promise<string | null> {
    try {
      const implementation = await this.findOne(implementationId);
      
      const response = await this.serviceDiscovery.callService(
        'workflow-service',
        'POST',
        '/workflows/approvals',
        {
          entityType: 'control_implementation',
          entityId: implementationId,
          workflowType: 'implementation_approval',
          controlId: implementation.controlId,
          organizationId: implementation.organizationId,
          ...approvalData,
        },
      );
      
      return (response.data as { workflowId?: string })?.workflowId || null;
    } catch (error) {
      console.error(`Failed to submit implementation ${implementationId} for approval`, error);
      return null;
    }
  }

  /**
   * Update implementation with evidence validation
   */
  async updateWithEvidenceValidation(id: string, updateDto: UpdateImplementationDto): Promise<ControlImplementation> {
    const implementation = await this.update(id, updateDto);
    
    // If evidence was provided, validate it - type-safe check
    const dtoWithEvidence = updateDto as UpdateDtoWithEvidence;
    if (this.hasEvidence(dtoWithEvidence) && dtoWithEvidence.evidence && dtoWithEvidence.evidence.length > 0) {
      for (const evidenceId of dtoWithEvidence.evidence) {
        try {
          await this.serviceDiscovery.callService(
            'evidence-service',
            'POST',
            `/evidence/${evidenceId}/validate`,
            {
              implementationId: id,
              controlId: implementation.controlId,
            },
          );
        } catch (error) {
          console.error(`Failed to validate evidence ${evidenceId} for implementation ${id}`, error);
        }
      }
    }
    
    return implementation;
  }

  /**
   * Predict implementation success based on historical data
   */
  async predictImplementationSuccess(controlId: string, organizationId: string): Promise<any> {
    try {
      // Get historical implementation data
      const historicalData = await this.implementationRepository
        .createQueryBuilder('impl')
        .leftJoinAndSelect('impl.control', 'control')
        .where('impl.organizationId = :organizationId', { organizationId })
        .andWhere('control.category = (SELECT category FROM controls WHERE id = :controlId)', { controlId })
        .getMany();

      // Calculate success metrics
      const totalImplementations = historicalData.length;
      const successfulImplementations = historicalData.filter(
        impl => impl.status === ImplementationStatus.IMPLEMENTED
      ).length;

      const successRate = totalImplementations > 0 
        ? (successfulImplementations / totalImplementations) * 100 
        : 50; // Default to 50% if no data

      // Calculate risk factors
      const control = await this.controlRepository.findOne({
        where: { id: controlId },
      });

      let riskAdjustment = 0;
      if (control) {
        // Higher complexity reduces success probability
        if (control.complexity === 'HIGH') riskAdjustment -= 20;
        else if (control.complexity === 'MEDIUM') riskAdjustment -= 10;
        
        // Manual controls are harder to implement
        if (control.automationLevel === 'MANUAL') riskAdjustment -= 15;
        
        // Critical controls get more attention
        if (control.riskRating === 'HIGH' || control.riskRating === 'CRITICAL') {
          riskAdjustment += 10;
        }
      }

      const adjustedSuccessRate = Math.max(10, Math.min(95, successRate + riskAdjustment));

      return {
        predictedSuccessRate: adjustedSuccessRate,
        confidence: totalImplementations > 5 ? 'HIGH' : totalImplementations > 2 ? 'MEDIUM' : 'LOW',
        basedOnSamples: totalImplementations,
        riskFactors: {
          complexity: control?.complexity || 'UNKNOWN',
          automationLevel: control?.automationLevel || 'UNKNOWN',
          riskRating: control?.riskRating || 'UNKNOWN',
        },
        recommendation: adjustedSuccessRate > 70 
          ? 'Low risk - proceed with implementation'
          : adjustedSuccessRate > 50 
          ? 'Medium risk - consider additional resources'
          : 'High risk - thorough planning required',
      };
    } catch (error) {
      console.error(`Failed to predict implementation success for control ${controlId}`, error);
      return {
        predictedSuccessRate: 50,
        confidence: 'LOW',
        basedOnSamples: 0,
        error: 'Prediction unavailable',
      };
    }
  }

  /**
   * Get implementation timeline based on control complexity and resources
   */
  async getImplementationTimeline(controlId: string, organizationId: string): Promise<any> {
    try {
      const control = await this.controlRepository.findOne({
        where: { id: controlId },
      });

      if (!control) {
        throw new NotFoundException('Control not found');
      }

      // Base timeline in days based on complexity
      let baseDays = 30; // Default
      switch (control.complexity) {
        case 'HIGH':
          baseDays = 90;
          break;
        case 'MEDIUM':
          baseDays = 60;
          break;
        case 'LOW':
          baseDays = 30;
          break;
      }

      // Adjust for automation level
      if (control.automationLevel === 'MANUAL') {
        baseDays += 30; // Manual controls take longer
      } else if (control.automationLevel === 'FULLY_AUTOMATED') {
        baseDays -= 15; // Automated controls are faster
      }

      // Check current workload
      const currentImplementations = await this.implementationRepository.count({
        where: {
          organizationId,
          status: ImplementationStatus.IN_PROGRESS,
        },
      });

      // Adjust for workload
      const workloadMultiplier = 1 + (currentImplementations * 0.1);
      const adjustedDays = Math.ceil(baseDays * workloadMultiplier);

      const startDate = new Date();
      const estimatedCompletionDate = new Date(startDate.getTime() + adjustedDays * 24 * 60 * 60 * 1000);

      // Create milestone timeline
      const milestones = [];
      const planningPhase = Math.ceil(adjustedDays * 0.2);
      const implementationPhase = Math.ceil(adjustedDays * 0.6);
      const testingPhase = adjustedDays - planningPhase - implementationPhase;

      milestones.push({
        phase: 'Planning',
        startDate: startDate,
        endDate: new Date(startDate.getTime() + planningPhase * 24 * 60 * 60 * 1000),
        duration: planningPhase,
        description: 'Requirements analysis and planning',
      });

      const implementationStart = new Date(startDate.getTime() + planningPhase * 24 * 60 * 60 * 1000);
      milestones.push({
        phase: 'Implementation',
        startDate: implementationStart,
        endDate: new Date(implementationStart.getTime() + implementationPhase * 24 * 60 * 60 * 1000),
        duration: implementationPhase,
        description: 'Control implementation and configuration',
      });

      const testingStart = new Date(implementationStart.getTime() + implementationPhase * 24 * 60 * 60 * 1000);
      milestones.push({
        phase: 'Testing & Validation',
        startDate: testingStart,
        endDate: estimatedCompletionDate,
        duration: testingPhase,
        description: 'Testing, validation, and documentation',
      });

      return {
        controlId,
        controlCode: control.code,
        controlName: control.name,
        totalDuration: adjustedDays,
        estimatedStartDate: startDate,
        estimatedCompletionDate,
        milestones,
        factors: {
          complexity: control.complexity,
          automationLevel: control.automationLevel,
          currentWorkload: currentImplementations,
          workloadImpact: workloadMultiplier,
        },
        recommendations: [
          adjustedDays > 90 ? 'Consider breaking into smaller phases' : null,
          currentImplementations > 5 ? 'High workload detected - may need additional resources' : null,
          control.automationLevel === 'MANUAL' ? 'Consider automation to reduce timeline' : null,
        ].filter(Boolean),
      };
    } catch (error) {
      console.error(`Failed to get implementation timeline for control ${controlId}`, error);
      throw new BadRequestException(`Failed to generate timeline: ${error.message}`);
    }
  }
}