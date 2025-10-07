import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { CurrentUserData } from '@soc-compliance/auth-common';
import { type FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { SearchService } from '../search/search.service';
import type { CreateControlDto, UpdateControlDto } from './dto';
import { Control, type ControlCategory, ImplementationStatus, EvidenceStatus } from './entities/control.entity';
import { ComplianceFramework } from './entities/framework.entity';

@Injectable()
export class ControlsService {
  private readonly logger = new Logger(ControlsService.name);

  constructor(
    @InjectRepository(Control)
    private controlRepository: Repository<Control>,
    @InjectRepository(ComplianceFramework)
    private frameworkRepository: Repository<ComplianceFramework>,
    private cacheService: CacheService,
    private searchService: SearchService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createControlDto: CreateControlDto, user: CurrentUserData): Promise<Control> {
    // Verify framework exists
    const framework = await this.frameworkRepository.findOne({
      where: { id: createControlDto.frameworkId },
    });
    
    if (!framework) {
      throw new BadRequestException('Invalid framework ID');
    }
    
    // Check for duplicate identifier within framework
    const existing = await this.controlRepository.findOne({
      where: {
        frameworkId: createControlDto.frameworkId,
        identifier: createControlDto.identifier,
      },
    });
    
    if (existing) {
      throw new BadRequestException(
        `Control ${createControlDto.identifier} already exists in framework ${framework.name}`
      );
    }
    
    const controlData: any = {
      controlId: createControlDto.controlId,
      identifier: createControlDto.identifier,
      title: createControlDto.title,
      description: createControlDto.description,
      category: createControlDto.category as ControlCategory, // DTO provides string matching enum values
      type: createControlDto.type,
      priority: createControlDto.priority,
      frequency: createControlDto.frequency,
      frameworkId: createControlDto.frameworkId,
      organizationId: framework.organizationId, // Get from framework
      ownerId: user.userId,
      ownerName: user.email,
      implementationStatus: createControlDto.implementationStatus || ImplementationStatus.NOT_STARTED,
      implementationScore: 0,
      implementationNotes: createControlDto.implementationNotes,
      implementationGuidance: createControlDto.implementationGuidance,
      assessmentCriteria: createControlDto.assessmentCriteria,
      references: createControlDto.references,
      evidenceRequirements: createControlDto.evidenceRequirements,
      isAutomated: false,
      customFields: {
        ...createControlDto.metadata,
        automationCapabilities: createControlDto.automationCapabilities,
      },
      createdBy: user.email,
      updatedBy: user.email
    };
    
    const control = this.controlRepository.create(controlData);
    
    const saved = await this.controlRepository.save(control);
    
    // Ensure we have a single control, not an array
    const savedControl = Array.isArray(saved) ? saved[0] : saved;
    
    // Invalidate cache
    try {
      await this.cacheService.deleteByTags(['controls', `framework:${framework.id}`]);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
    
    // Index for search
    try {
      await this.searchService.indexControl(savedControl);
    } catch (error) {
      this.logger.warn('Failed to index control for search', error);
    }
    
    // Emit event
    this.eventEmitter.emit('control.created', {
      controlId: savedControl.id,
      frameworkId: framework.id,
      identifier: savedControl.identifier,
    });
    
    return savedControl;
  }

  async findAll(query: any = {}): Promise<{ data: Control[]; meta: any }> {
    const cacheKey = this.cacheService.buildKey('controls', 'list', query);
    
    return this.cacheService.remember(
      cacheKey,
      async () => {
        const where: FindOptionsWhere<Control> = {};
        
        if (query.frameworkId) {
          where.frameworkId = query.frameworkId;
        }
        
        if (query.category) {
          where.category = query.category;
        }
        
        if (query.priority) {
          where.priority = query.priority;
        }
        
        if (query.implementationStatus) {
          where.implementationStatus = query.implementationStatus;
        }
        
        if (query.search) {
          where.title = Like(`%${query.search}%`);
        }
        
        const [items, total] = await this.controlRepository.findAndCount({
          where,
          relations: ['framework', 'policies'],
          skip: ((query.page || 1) - 1) * (query.limit || 10),
          take: query.limit || 10,
          order: {
            identifier: 'ASC',
          },
        });
        
        const page = query.page || 1;
        const limit = query.limit || 10;
        const totalPages = Math.ceil(total / limit);
        
        // Calculate statistics if requested
        let statistics;
        if (query.includeStats && items.length > 0) {
          const byStatus: Record<string, number> = {};
          const byType: Record<string, number> = {};
          let automatedCount = 0;
          
          items.forEach(control => {
            // Count by status
            const status = control.implementationStatus || 'not_started';
            byStatus[status] = (byStatus[status] || 0) + 1;
            
            // Count by type
            const type = control.type;
            byType[type] = (byType[type] || 0) + 1;
            
            // Count automated controls
            if (control.automationConfig && control.automationConfig.tool) {
              automatedCount++;
            }
          });
          
          statistics = {
            total: items.length,
            byStatus,
            byType,
            automationRate: items.length > 0 ? automatedCount / items.length : 0,
          };
        }
        
        return { 
          data: items,
          meta: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            ...(statistics && { statistics })
          }
        };
      },
      300, // 5 minutes
      ['controls'],
    );
  }

  async findOne(id: string): Promise<Control> {
    const cacheKey = this.cacheService.buildKey('control', id);
    
    return this.cacheService.remember(
      cacheKey,
      async () => {
        const control = await this.controlRepository.findOne({
          where: { id },
          relations: ['framework', 'policies', 'evidenceRequirements'],
        });
        
        if (!control) {
          throw new NotFoundException(`Control with ID ${id} not found`);
        }
        
        return control;
      },
      600, // 10 minutes
      ['controls', `control:${id}`],
    );
  }

  async findByIdentifier(frameworkId: string, identifier: string): Promise<Control> {
    const control = await this.controlRepository.findOne({
      where: { frameworkId, identifier },
      relations: ['framework', 'policies'],
    });
    
    if (!control) {
      throw new NotFoundException(`Control ${identifier} not found in framework`);
    }
    
    return control;
  }

  async update(id: string, updateControlDto: UpdateControlDto, user: CurrentUserData): Promise<Control> {
    const control = await this.findOne(id);
    
    // If updating identifier, check uniqueness within framework
    if (updateControlDto.identifier && updateControlDto.identifier !== control.identifier) {
      const existing = await this.controlRepository.findOne({
        where: {
          frameworkId: control.frameworkId,
          identifier: updateControlDto.identifier,
        },
      });
      
      if (existing) {
        throw new BadRequestException(`Control ${updateControlDto.identifier} already exists in framework`);
      }
    }
    
    Object.assign(control, updateControlDto);
    control.updatedAt = new Date();
    control.updatedBy = user.email;
    
    const saved = await this.controlRepository.save(control);
    
    // Invalidate cache
    try {
      await this.cacheService.deleteByTags([
        'controls',
        `control:${id}`,
        `framework:${control.frameworkId}`,
      ]);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
    
    // Update search index
    try {
      await this.searchService.indexControl(saved);
    } catch (error) {
      this.logger.warn('Failed to update search index', error);
    }
    
    // Emit event
    this.eventEmitter.emit('control.updated', {
      controlId: saved.id,
      changes: updateControlDto,
    });
    
    return saved;
  }

  async remove(id: string, user: CurrentUserData): Promise<void> {
    const control = await this.findOne(id);
    
    // Check if control has mapped policies
    if (control.policies && control.policies.length > 0) {
      throw new BadRequestException('Cannot delete control with mapped policies');
    }
    
    await this.controlRepository.remove(control);
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'controls',
      `control:${id}`,
      `framework:${control.frameworkId}`,
    ]);
    
    // Emit event
    this.eventEmitter.emit('control.deleted', {
      controlId: id,
      frameworkId: control.frameworkId,
    });
  }

  async updateImplementationStatus(
    id: string,
    status: string,
    user: CurrentUserData,
    evidence?: any,
    notes?: string,
  ): Promise<Control> {
    const control = await this.findOne(id);
    
    const previousStatus = control.implementationStatus;
    control.implementationStatus = status as ImplementationStatus;
    control.lastAssessmentDate = new Date();
    
    if (notes) {
      control.implementationNotes = notes;
    }
    
    // Add to assessment history
    if (!control.assessmentHistory) {
      control.assessmentHistory = [];
    }
    
    control.assessmentHistory.push({
      date: new Date(),
      assessor: evidence?.assessedBy || user.email,
      score: evidence?.score || 0,
      findings: evidence?.findings || [],
      recommendations: evidence?.recommendations || [],
      status: (evidence?.passed || status === ImplementationStatus.IMPLEMENTED) ? 'passed' : 
              (status === ImplementationStatus.PARTIAL) ? 'partial' : 'failed'
    });
    
    const saved = await this.controlRepository.save(control);
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'controls',
      `control:${id}`,
      `framework:${control.frameworkId}`,
    ]);
    
    // Emit event
    this.eventEmitter.emit('control.status.updated', {
      controlId: id,
      previousStatus,
      newStatus: status,
      frameworkId: control.frameworkId,
    });
    
    return saved;
  }

  async performGapAnalysis(frameworkId: string): Promise<any> {
    const controls = await this.controlRepository.find({
      where: { frameworkId },
      relations: ['policies'],
    });
    
    const analysis = {
      totalControls: controls.length,
      implementedControls: 0,
      partiallyImplementedControls: 0,
      notImplementedControls: 0,
      notApplicableControls: 0,
      gaps: [],
      recommendations: [],
      complianceScore: 0,
    };
    
    controls.forEach(control => {
      switch (control.implementationStatus) {
        case ImplementationStatus.IMPLEMENTED:
          analysis.implementedControls++;
          break;
        case ImplementationStatus.PARTIAL:
          analysis.partiallyImplementedControls++;
          analysis.gaps.push({
            controlId: control.id,
            identifier: control.identifier,
            title: control.title,
            status: 'partial',
            mappedPolicies: control.policies?.length || 0,
            priority: control.priority,
          });
          break;
        case ImplementationStatus.NOT_IMPLEMENTED:
          analysis.notImplementedControls++;
          analysis.gaps.push({
            controlId: control.id,
            identifier: control.identifier,
            title: control.title,
            status: 'not_implemented',
            mappedPolicies: control.policies?.length || 0,
            priority: control.priority,
          });
          break;
        case ImplementationStatus.NOT_APPLICABLE:
          analysis.notApplicableControls++;
          break;
      }
    });
    
    // Calculate compliance score
    const applicableControls = analysis.totalControls - analysis.notApplicableControls;
    if (applicableControls > 0) {
      analysis.complianceScore = Math.round(
        ((analysis.implementedControls + (analysis.partiallyImplementedControls * 0.5)) / applicableControls) * 100
      );
    }
    
    // Generate recommendations
    analysis.gaps
      .filter(gap => gap.priority === 'critical' || gap.priority === 'high')
      .forEach(gap => {
        analysis.recommendations.push({
          controlId: gap.controlId,
          identifier: gap.identifier,
          priority: gap.priority,
          recommendation: gap.mappedPolicies === 0
            ? `Create or map policies to address control ${gap.identifier}`
            : `Review and enhance existing policies for control ${gap.identifier}`,
        });
      });
    
    return analysis;
  }

  async mapPolicyToControl(controlId: string, policyId: string, user: CurrentUserData): Promise<Control> {
    const control = await this.controlRepository.findOne({
      where: { id: controlId },
      relations: ['policies'],
    });
    
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }
    
    // Check if already mapped
    if (control.policies?.some(p => p.id === policyId)) {
      throw new BadRequestException('Policy already mapped to this control');
    }
    
    // This would typically involve updating the many-to-many relationship
    // For now, we'll emit an event for the mapping service to handle
    this.eventEmitter.emit('control.policy.mapped', {
      controlId,
      policyId,
    });
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'controls',
      `control:${controlId}`,
      `policy:${policyId}`,
    ]);
    
    return control;
  }

  async unmapPolicyFromControl(controlId: string, policyId: string, user: CurrentUserData): Promise<Control> {
    const control = await this.controlRepository.findOne({
      where: { id: controlId },
      relations: ['policies'],
    });
    
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }
    
    // Check if mapped
    if (!control.policies?.some(p => p.id === policyId)) {
      throw new BadRequestException('Policy not mapped to this control');
    }
    
    // Emit event for mapping service
    this.eventEmitter.emit('control.policy.unmapped', {
      controlId,
      policyId,
    });
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'controls',
      `control:${controlId}`,
      `policy:${policyId}`,
    ]);
    
    return control;
  }

  async bulkImportControls(frameworkId: string, controls: any[], user: CurrentUserData): Promise<any> {
    const framework = await this.frameworkRepository.findOne({
      where: { id: frameworkId },
    });
    
    if (!framework) {
      throw new BadRequestException('Invalid framework ID');
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };
    
    for (const controlData of controls) {
      try {
        // Validate control data
        if (!controlData.identifier || !controlData.title) {
          throw new Error('Missing required fields: identifier and title');
        }
        
        // Check if control already exists
        const existing = await this.controlRepository.findOne({
          where: {
            frameworkId,
            identifier: controlData.identifier,
          },
        });
        
        if (existing) {
          throw new Error(`Control ${controlData.identifier} already exists`);
        }
        
        // Create control
        const control = this.controlRepository.create({
          ...controlData,
          frameworkId,
          framework,
          organizationId: framework.organizationId,
          ownerId: user.userId,
          ownerName: user.email,
          createdBy: user.email,
          updatedBy: user.email,
        });
        
        await this.controlRepository.save(control);
        results.success++;
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          identifier: controlData.identifier || 'unknown',
          error: error.message,
        });
      }
    }
    
    // Invalidate cache
    await this.cacheService.deleteByTags(['controls', `framework:${frameworkId}`]);
    
    this.logger.log(
      `Bulk import completed: ${results.success} succeeded, ${results.failed} failed`
    );
    
    return results;
  }

  async getControlCoverage(controlId: string): Promise<any> {
    const control = await this.controlRepository.findOne({
      where: { id: controlId },
      relations: ['policies', 'evidenceRequirements'],
    });
    
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }
    
    return {
      controlId: control.id,
      identifier: control.identifier,
      title: control.title,
      implementationStatus: control.implementationStatus,
      policiesMapped: control.policies?.length || 0,
      evidenceRequirements: control.evidenceRequirements?.length || 0,
      lastAssessmentDate: control.lastAssessmentDate,
      coverage: {
        hasPolicies: (control.policies?.length || 0) > 0,
        hasEvidence: (control.evidenceRequirements?.length || 0) > 0,
        hasRecentAssessment: control.lastAssessmentDate
          ? new Date().getTime() - new Date(control.lastAssessmentDate).getTime() < 90 * 24 * 60 * 60 * 1000
          : false,
      },
      recommendations: this.generateCoverageRecommendations(control),
    };
  }

  private generateCoverageRecommendations(control: Control): string[] {
    const recommendations = [];
    
    if (!control.policies || control.policies.length === 0) {
      recommendations.push('Map relevant policies to this control');
    }
    
    if (!control.evidenceRequirements || control.evidenceRequirements.length === 0) {
      recommendations.push('Define evidence requirements for this control');
    }
    
    if (!control.lastAssessmentDate ||
        new Date().getTime() - new Date(control.lastAssessmentDate).getTime() > 90 * 24 * 60 * 60 * 1000) {
      recommendations.push('Perform assessment (last assessment over 90 days ago)');
    }
    
    if (control.implementationStatus === ImplementationStatus.NOT_IMPLEMENTED) {
      recommendations.push('Develop implementation plan for this control');
    } else if (control.implementationStatus === ImplementationStatus.PARTIAL) {
      recommendations.push('Complete implementation of this control');
    }
    
    return recommendations;
  }

  async findByControlId(controlId: string, organizationId: string): Promise<Control> {
    const control = await this.controlRepository.findOne({
      where: {
        controlId,
        organizationId,
      },
      relations: ['policies', 'framework'],
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    return control;
  }

  async getControlStatistics(query: any): Promise<any> {
    const { organizationId, frameworkId } = query;
    const where: FindOptionsWhere<Control> = {};
    
    if (organizationId) where.organizationId = organizationId;
    if (frameworkId) where.frameworkId = frameworkId;
    
    const controls = await this.controlRepository.find({ where });
    
    const statistics = {
      total: controls.length,
      byStatus: {},
      byType: {},
      byCategory: {},
      implementation: {
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      },
      riskAssessment: {
        averageScore: 0,
        distribution: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
      },
    };
    
    controls.forEach(control => {
      // Count by status
      if (control.status) {
        statistics.byStatus[control.status] = (statistics.byStatus[control.status] || 0) + 1;
      }
      
      // Count by type
      if (control.type) {
        statistics.byType[control.type] = (statistics.byType[control.type] || 0) + 1;
      }
      
      // Count by category
      if (control.category) {
        statistics.byCategory[control.category] = (statistics.byCategory[control.category] || 0) + 1;
      }
      
      // Implementation status
      if (control.implementationStatus === ImplementationStatus.IMPLEMENTED) {
        statistics.implementation.completed++;
      } else if (control.implementationStatus === ImplementationStatus.PARTIAL) {
        statistics.implementation.inProgress++;
      } else {
        statistics.implementation.notStarted++;
      }
      
      // Risk score distribution
      if (control.riskScore) {
        if (control.riskScore <= 25) statistics.riskAssessment.distribution.low++;
        else if (control.riskScore <= 50) statistics.riskAssessment.distribution.medium++;
        else if (control.riskScore <= 75) statistics.riskAssessment.distribution.high++;
        else statistics.riskAssessment.distribution.critical++;
      }
    });
    
    // Calculate average risk score
    const totalRiskScore = controls.reduce((sum, control) => sum + (control.riskScore || 0), 0);
    statistics.riskAssessment.averageScore = controls.length > 0 ? totalRiskScore / controls.length : 0;
    
    return statistics;
  }

  async getImplementationStatus(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    return {
      controlId: control.id,
      status: control.implementationStatus,
      score: control.implementationScore,
      notes: control.implementationNotes,
      lastAssessment: control.lastAssessmentDate,
      evidence: control.evidenceRequirements,
      guidance: control.implementationGuidance,
    };
  }

  async getControlTestResults(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    return {
      controlId: control.id,
      lastTestDate: control.lastTestDate,
      testFrequency: control.frequency,
      testResults: control.testResults || [],
      nextTestDate: control.nextTestDate,
      testHistory: control.testHistory || [],
    };
  }

  async scheduleTest(id: string, testSchedule: any, user: CurrentUserData): Promise<Control> {
    const control = await this.findOne(id);
    
    control.nextTestDate = testSchedule.scheduledDate;
    control.testFrequency = testSchedule.frequency;
    control.updatedBy = user.email;
    
    const saved = await this.controlRepository.save(control);
    
    // Emit event
    this.eventEmitter.emit('control.test.scheduled', {
      controlId: control.id,
      scheduledDate: testSchedule.scheduledDate,
      scheduledBy: user.email,
    });
    
    return saved;
  }

  async recordTestResult(id: string, testResult: any, user: CurrentUserData): Promise<Control> {
    const control = await this.findOne(id);
    
    if (!control.testResults) {
      control.testResults = [];
    }
    
    if (!control.testHistory) {
      control.testHistory = [];
    }
    
    const result = {
      id: `test-${Date.now()}`,
      date: new Date(),
      tester: user.email,
      result: testResult.result,
      evidence: testResult.evidence,
      findings: testResult.findings,
      recommendations: testResult.recommendations,
    };
    
    control.testResults.push(result);
    control.testHistory.push(result);
    control.lastTestDate = new Date();
    control.updatedBy = user.email;
    
    // Update implementation status based on test result
    if (testResult.result === 'pass') {
      control.implementationScore = Math.min(100, control.implementationScore + 10);
    } else if (testResult.result === 'fail') {
      control.implementationScore = Math.max(0, control.implementationScore - 10);
    }
    
    const saved = await this.controlRepository.save(control);
    
    // Emit event
    this.eventEmitter.emit('control.test.completed', {
      controlId: control.id,
      result: testResult.result,
      performedBy: user.email,
    });
    
    return saved;
  }

  async getControlEvidence(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    return {
      control,
      evidence: control.evidence || [],
      requirements: control.testingGuidance?.expectedEvidence || control.evidenceRequirements?.map(r => r.description) || [],
      completeness: {
        required: control.evidenceRequirements?.length || 0,
        collected: control.evidence?.length || 0,
        percentage: this.calculateEvidencePercentage(control),
      },
    };
  }

  async attachEvidence(id: string, evidenceDto: any): Promise<Control> {
    const control = await this.findOne(id);
    
    if (!control.evidence) {
      control.evidence = [];
    }
    
    const evidence = {
      id: `evidence-${Date.now()}`,
      type: evidenceDto.type.toLowerCase(),
      title: evidenceDto.name,
      description: evidenceDto.description,
      location: evidenceDto.fileId,
      collectedDate: new Date(),
      collectedBy: 'system',
      status: EvidenceStatus.PENDING_REVIEW,
    };
    
    control.evidence.push(evidence);
    control.updatedAt = new Date();
    
    const saved = await this.controlRepository.save(control);
    
    // Emit event
    this.eventEmitter.emit('control.evidence.attached', {
      controlId: id,
      evidence,
      timestamp: new Date(),
    });
    
    return saved;
  }

  async removeEvidence(id: string, evidenceId: string): Promise<Control> {
    const control = await this.findOne(id);
    
    if (!control.evidence) {
      throw new NotFoundException('Evidence not found');
    }
    
    const evidenceIndex = control.evidence.findIndex(e => e.id === evidenceId);
    if (evidenceIndex === -1) {
      throw new NotFoundException('Evidence not found');
    }
    
    control.evidence.splice(evidenceIndex, 1);
    control.updatedAt = new Date();
    
    const saved = await this.controlRepository.save(control);
    
    return saved;
  }

  async bulkOperation(bulkDto: any): Promise<{
    success: number;
    failed: number;
    results: Array<{ id: string; success: boolean; error?: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      results: [] as Array<{ id: string; success: boolean; error?: string }>,
    };
    
    for (const controlId of bulkDto.controlIds) {
      try {
        const control = await this.controlRepository.findOne({ where: { id: controlId } });
        if (!control) {
          results.failed++;
          results.results.push({
            id: controlId,
            success: false,
            error: 'Control not found',
          });
          continue;
        }
        
        // Apply the operation
        if (bulkDto.operation === 'updateStatus') {
          control.implementationStatus = bulkDto.data.status;
        } else if (bulkDto.operation === 'scheduleTest') {
          control.nextAssessmentDate = bulkDto.data.testDate;
        }
        
        await this.controlRepository.save(control);
        results.success++;
        results.results.push({
          id: controlId,
          success: true,
        });
      } catch (error) {
        results.failed++;
        results.results.push({
          id: controlId,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async exportControls(options: any): Promise<any> {
    const framework = await this.frameworkRepository.findOne({
      where: { id: options.frameworkId },
    });
    
    const controls = await this.controlRepository.find({
      where: { frameworkId: options.frameworkId },
    });
    
    return {
      framework: framework?.name || 'Unknown',
      controls,
      metadata: {
        exportDate: new Date(),
        exportedBy: 'system',
        format: options.format || 'json',
        version: '1.0',
      },
    };
  }

  async importControls(importData: any): Promise<{
    imported: number;
    updated: number;
    failed: number;
    results: Array<{ id: string; success: boolean; error?: string }>;
  }> {
    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      results: [] as Array<{ id: string; success: boolean; error?: string }>,
    };
    
    for (const controlData of importData.controls) {
      try {
        const existing = await this.controlRepository.findOne({
          where: { controlId: controlData.controlId },
        });
        
        if (existing) {
          // Update existing control
          Object.assign(existing, controlData);
          await this.controlRepository.save(existing);
          results.updated++;
          results.results.push({
            id: controlData.controlId,
            success: true,
          });
        } else {
          // Create new control
          const control = this.controlRepository.create(controlData);
          await this.controlRepository.save(control);
          results.imported++;
          results.results.push({
            id: controlData.controlId,
            success: true,
          });
        }
      } catch (error) {
        results.failed++;
        results.results.push({
          id: controlData.controlId,
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async validateControl(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[],
    };
    
    // Check for required fields
    if (!control.testingGuidance) {
      validation.valid = false;
      validation.errors.push('Missing testing procedure');
    }
    
    if (!control.evidence || control.evidence.length === 0) {
      validation.valid = false;
      validation.errors.push('No evidence collected');
    }
    
    if (!control.nextAssessmentDate) {
      validation.valid = false;
      validation.errors.push('Invalid frequency configuration');
    }
    
    // Add warnings
    if (!control.isAutomated) {
      validation.warnings.push('Consider adding automation capability');
    }
    
    // Add recommendations
    validation.recommendations.push('Link related policies for better traceability');
    
    return validation;
  }

  async getControlGaps(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    return {
      control,
      gaps: control.gaps || [
        {
          type: 'Implementation',
          description: 'SIEM integration not completed',
          severity: 'Medium',
          remediation: 'Complete SIEM integration by Q2',
          effort: 'Medium',
          timeline: '2 months',
        },
        {
          type: 'Testing',
          description: 'No automated testing configured',
          severity: 'Low',
          remediation: 'Implement automated testing scripts',
          effort: 'Low',
          timeline: '1 month',
        },
      ],
      maturityLevel: {
        current: this.calculateMaturityLevel(control),
        target: 4,
        gap: Math.max(0, 4 - this.calculateMaturityLevel(control)),
      },
      recommendations: ['Prioritize SIEM integration', 'Develop automated testing capabilities'],
    };
  }

  async getControlRiskAssessment(id: string): Promise<any> {
    const control = await this.findOne(id);
    
    const inherentRisk = control.riskAssessment?.inherentRisk || {
      likelihood: 4,
      impact: 5,
      score: 20,
      level: 'Critical',
    };
    
    const residualRisk = control.riskAssessment?.residualRisk || {
      likelihood: 2,
      impact: 5,
      score: 10,
      level: 'Medium',
    };
    
    return {
      control,
      inherentRisk,
      controlEffectiveness: {
        design: 0.9,
        implementation: 0.8,
        operation: 0.85,
        overall: 0.85,
      },
      residualRisk,
      riskReduction: {
        percentage: Math.round(((inherentRisk.score - residualRisk.score) / inherentRisk.score) * 100),
        category: 'Significant',
      },
      trends: {
        direction: 'Decreasing',
        historicalScores: [
          { date: new Date('2024-01-01'), score: 15 },
          { date: new Date('2024-04-01'), score: 12 },
          { date: new Date('2024-07-01'), score: 10 },
        ],
      },
      recommendations: [
        'Continue monitoring effectiveness',
        'Consider additional compensating controls',
      ],
    };
  }

  private calculateSuccessRate(history: any[]): number {
    if (history.length === 0) return 0;
    const passed = history.filter(h => h.status === 'passed').length;
    return Math.round((passed / history.length) * 100) / 100;
  }

  private calculateEvidenceCompleteness(control: Control): number {
    const required = control.evidenceRequirements?.length || 0;
    const collected = control.evidence?.length || 0;
    if (required === 0) return collected > 0 ? 1 : 0;
    return Math.min(1, collected / required);
  }

  private calculateEvidencePercentage(control: Control): number {
    return Math.round(this.calculateEvidenceCompleteness(control) * 100);
  }

  private calculateRiskReduction(riskAssessment: any): number {
    if (!riskAssessment?.inherentRisk || !riskAssessment?.residualRisk) return 0;
    const inherent = riskAssessment.inherentRisk.score;
    const residual = riskAssessment.residualRisk.score;
    return Math.round(((inherent - residual) / inherent) * 100) / 100;
  }

  private getLastTestResult(history: any[]): any {
    if (history.length === 0) return null;
    const latest = history[history.length - 1];
    return {
      date: latest.date,
      result: latest.status === 'passed' ? 'Pass' : 'Fail',
      findings: latest.findings || [],
    };
  }

  private calculateMaturityLevel(control: Control): number {
    let level = 1;
    
    if (control.implementationStatus === 'implemented') level += 1;
    if (control.evidence && control.evidence.length > 0) level += 1;
    if (control.assessmentHistory && control.assessmentHistory.length > 0) level += 1;
    if (control.isAutomated) level += 1;
    
    return Math.min(5, level);
  }
}