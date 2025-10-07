import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Traced, Metered, MetricsService, TracingService, LoggingService } from '@soc-compliance/monitoring';
import { In, IsNull, Like, Not, Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { Policy, PolicyStatus } from '../policies/entities/policy.entity';
import type { CreateMappingDto, QueryMappingDto, UpdateMappingDto } from './dto';
import type { CreatePolicyControlMappingDto } from './dto/create-policy-control-mapping.dto';
import { ComplianceMapping, MappingStatus } from './entities/compliance-mapping.entity';
import { Control } from './entities/control.entity';
import { ComplianceFramework } from './entities/framework.entity';

@Injectable()
export class ComplianceMappingService {
  private readonly logger = new Logger(ComplianceMappingService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(Control)
    private controlRepository: Repository<Control>,
    @InjectRepository(ComplianceFramework)
    private frameworkRepository: Repository<ComplianceFramework>,
    @InjectRepository(ComplianceMapping)
    private mappingRepository: Repository<ComplianceMapping>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
    private metricsService: MetricsService,
    private tracingService: TracingService,
    private loggingService: LoggingService,
  ) {}

  @Observable({ spanName: 'compliance-policy-control-mapping', metricName: 'compliance_policy_control_mapping_duration_seconds' })
  async mapPolicyToControls(policyId: string, controlIds: string[]): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['controls'],
    });
    
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }
    
    const controls = await this.controlRepository.find({
      where: { id: In(controlIds) },
    });
    
    if (controls.length !== controlIds.length) {
      throw new BadRequestException('One or more control IDs are invalid');
    }
    
    // Update policy controls
    policy.controls = controls;
    policy.complianceMetadata = {
      ...policy.complianceMetadata,
      lastMappingUpdate: new Date(),
      mappedControlsCount: controls.length,
      frameworks: [...new Set(controls.map(c => c.frameworkId))],
    };
    
    const saved = await this.policyRepository.save(policy);
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'policies',
      `policy:${policyId}`,
      ...controlIds.map(id => `control:${id}`),
    ]);
    
    // Emit event
    this.eventEmitter.emit('policy.controls.mapped', {
      policyId,
      controlIds,
      timestamp: new Date(),
    });
    
    return saved;
  }

  async unmapPolicyFromControls(policyId: string, controlIds: string[]): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['controls'],
    });
    
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }
    
    // Remove specified controls
    policy.controls = policy.controls.filter(c => !controlIds.includes(c.id));
    
    policy.complianceMetadata = {
      ...policy.complianceMetadata,
      lastMappingUpdate: new Date(),
      mappedControlsCount: policy.controls.length,
      frameworks: [...new Set(policy.controls.map(c => c.frameworkId))],
    };
    
    const saved = await this.policyRepository.save(policy);
    
    // Invalidate cache
    await this.cacheService.deleteByTags([
      'policies',
      `policy:${policyId}`,
      ...controlIds.map(id => `control:${id}`),
    ]);
    
    // Emit event
    this.eventEmitter.emit('policy.controls.unmapped', {
      policyId,
      controlIds,
      timestamp: new Date(),
    });
    
    return saved;
  }

  async getPolicyMappings(policyId: string): Promise<any> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['controls', 'controls.framework'],
    });
    
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }
    
    // Group controls by framework
    const mappingsByFramework = policy.controls.reduce((acc, control) => {
      const frameworkId = control.framework.id;
      if (!acc[frameworkId]) {
        acc[frameworkId] = {
          framework: {
            id: control.framework.id,
            identifier: control.framework.identifier,
            name: control.framework.name,
            version: control.framework.version,
          },
          controls: [],
        };
      }
      acc[frameworkId].controls.push({
        id: control.id,
        identifier: control.identifier,
        title: control.title,
        category: control.category,
        priority: control.priority,
        implementationStatus: control.implementationStatus,
      });
      return acc;
    }, {});
    
    return {
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      policyTitle: policy.title,
      totalMappings: policy.controls.length,
      frameworks: Object.values(mappingsByFramework),
    };
  }

  async getControlMappings(controlId: string): Promise<any> {
    const control = await this.controlRepository.findOne({
      where: { id: controlId },
      relations: ['policies', 'framework'],
    });
    
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }
    
    return {
      controlId: control.id,
      controlIdentifier: control.identifier,
      controlTitle: control.title,
      framework: {
        id: control.framework.id,
        identifier: control.framework.identifier,
        name: control.framework.name,
      },
      mappedPolicies: control.policies.map(policy => ({
        id: policy.id,
        policyNumber: policy.policyNumber,
        title: policy.title,
        type: policy.type,
        status: policy.status,
        effectiveDate: policy.effectiveDate,
      })),
      totalMappings: control.policies.length,
    };
  }

  async suggestMappings(policyId: string, frameworkId?: string): Promise<any[]> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['controls'],
    });
    
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }
    
    // Get already mapped control IDs
    const mappedControlIds = policy.controls.map(c => c.id);
    
    // Build query for potential controls
    const query = this.controlRepository.createQueryBuilder('control')
      .leftJoinAndSelect('control.framework', 'framework')
      .where('control.id NOT IN (:...mappedIds)', { mappedIds: mappedControlIds.length > 0 ? mappedControlIds : [''] });
    
    if (frameworkId) {
      query.andWhere('control.frameworkId = :frameworkId', { frameworkId });
    }
    
    const potentialControls = await query.getMany();
    
    // Score each control based on relevance
    const suggestions = potentialControls.map(control => {
      let score = 0;
      const reasons = [];
      
      // Check keyword matches
      const policyKeywords = this.extractKeywords(policy.title + ' ' + policy.content);
      const controlKeywords = this.extractKeywords(control.title + ' ' + control.description);
      
      const matchingKeywords = policyKeywords.filter(k => controlKeywords.includes(k));
      score += matchingKeywords.length * 10;
      if (matchingKeywords.length > 0) {
        reasons.push(`Keyword matches: ${matchingKeywords.join(', ')}`);
      }
      
      // Check category match
      if (policy.complianceMetadata?.categories?.includes(control.category)) {
        score += 20;
        reasons.push(`Category match: ${control.category}`);
      }
      
      // Check priority alignment
      if (policy.priority === 'critical' && control.priority === 'critical') {
        score += 15;
        reasons.push('Both are critical priority');
      }
      
      // Check if other policies of same type are mapped to this control
      // This would require additional query logic
      
      return {
        control: {
          id: control.id,
          identifier: control.identifier,
          title: control.title,
          description: control.description,
          category: control.category,
          priority: control.priority,
          framework: {
            id: control.framework.id,
            name: control.framework.name,
          },
        },
        score,
        reasons,
      };
    })
    .filter(suggestion => suggestion.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 suggestions
    
    return suggestions;
  }

  async getComplianceCoverage(frameworkId?: string): Promise<any> {
    const cacheKey = this.cacheService.buildKey('compliance', 'coverage', frameworkId || 'all');
    
    return this.cacheService.remember(
      cacheKey,
      async () => {
        let controls;
        
        if (frameworkId) {
          controls = await this.controlRepository.find({
            where: { frameworkId },
            relations: ['policies', 'framework'],
          });
        } else {
          controls = await this.controlRepository.find({
            relations: ['policies', 'framework'],
          });
        }
        
        // Group by framework
        const coverageByFramework = controls.reduce((acc, control) => {
          const fwId = control.framework.id;
          if (!acc[fwId]) {
            acc[fwId] = {
              framework: {
                id: control.framework.id,
                identifier: control.framework.identifier,
                name: control.framework.name,
                version: control.framework.version,
              },
              totalControls: 0,
              mappedControls: 0,
              unmappedControls: 0,
              coverage: 0,
              controlsByStatus: {
                implemented: 0,
                partial: 0,
                not_implemented: 0,
                not_applicable: 0,
              },
              controlsByPriority: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
              },
            };
          }
          
          const fw = acc[fwId];
          fw.totalControls++;
          
          if (control.policies && control.policies.length > 0) {
            fw.mappedControls++;
          } else {
            fw.unmappedControls++;
          }
          
          if (control.implementationStatus) {
            fw.controlsByStatus[control.implementationStatus]++;
          }
          
          if (control.priority) {
            fw.controlsByPriority[control.priority]++;
          }
          
          return acc;
        }, {});
        
        // Calculate coverage percentages
        Object.values(coverageByFramework).forEach((fw: any) => {
          fw.coverage = fw.totalControls > 0
            ? Math.round((fw.mappedControls / fw.totalControls) * 100)
            : 0;
        });
        
        return {
          frameworks: Object.values(coverageByFramework),
          summary: {
            totalFrameworks: Object.keys(coverageByFramework).length,
            totalControls: controls.length,
            totalMapped: controls.filter(c => c.policies && c.policies.length > 0).length,
            totalUnmapped: controls.filter(c => !c.policies || c.policies.length === 0).length,
            overallCoverage: controls.length > 0
              ? Math.round((controls.filter(c => c.policies && c.policies.length > 0).length / controls.length) * 100)
              : 0,
          },
        };
      },
      600, // 10 minutes
      ['compliance', 'controls', 'policies'],
    );
  }

  async generateComplianceMatrix(frameworkIds: string[]): Promise<any> {
    const frameworks = await this.frameworkRepository.find({
      where: { id: In(frameworkIds) },
      relations: ['controls', 'controls.policies'],
    });
    
    if (frameworks.length !== frameworkIds.length) {
      throw new BadRequestException('One or more framework IDs are invalid');
    }
    
    // Build matrix structure
    const matrix = {
      frameworks: frameworks.map(fw => ({
        id: fw.id,
        identifier: fw.identifier,
        name: fw.name,
        version: fw.version,
      })),
      policies: new Map(),
      mappings: [],
    };
    
    // Collect all unique policies
    const allPolicies = new Set<Policy>();
    frameworks.forEach(framework => {
      framework.controls.forEach(control => {
        control.policies?.forEach(policy => {
          allPolicies.add(policy);
          matrix.policies.set(policy.id, {
            id: policy.id,
            policyNumber: policy.policyNumber,
            title: policy.title,
            type: policy.type,
            status: policy.status,
          });
        });
      });
    });
    
    // Build mapping matrix
    Array.from(allPolicies).forEach(policy => {
      const policyMapping = {
        policyId: policy.id,
        frameworks: {},
      };
      
      frameworks.forEach(framework => {
        const mappedControls = framework.controls.filter(control =>
          control.policies?.some(p => p.id === policy.id)
        );
        
        policyMapping.frameworks[framework.id] = {
          controlCount: mappedControls.length,
          controls: mappedControls.map(c => ({
            id: c.id,
            identifier: c.identifier,
            title: c.title,
            implementationStatus: c.implementationStatus,
          })),
        };
      });
      
      matrix.mappings.push(policyMapping);
    });
    
    return {
      ...matrix,
      policies: Array.from(matrix.policies.values()),
      summary: {
        totalPolicies: matrix.policies.size,
        totalFrameworks: frameworks.length,
        totalMappings: matrix.mappings.reduce((sum, mapping) =>
          sum + Object.values(mapping.frameworks).reduce((fwSum: number, fw: any) =>
            fwSum + fw.controlCount, 0
          ), 0
        ),
      },
    };
  }

  async bulkMapPolicies(mappings: Array<{ policyId: string; controlIds: string[] }>): Promise<any> {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };
    
    for (const mapping of mappings) {
      try {
        await this.mapPolicyToControls(mapping.policyId, mapping.controlIds);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          policyId: mapping.policyId,
          error: error.message,
        });
      }
    }
    
    // Invalidate all compliance cache
    await this.cacheService.deleteByPattern('compliance:*');
    await this.cacheService.deleteByPattern('policies:*');
    await this.cacheService.deleteByPattern('controls:*');
    
    this.logger.log(
      `Bulk mapping completed: ${results.success} succeeded, ${results.failed} failed`
    );
    
    return results;
  }

  // Framework to framework mapping
  async createFrameworkMapping(createMappingDto: CreateMappingDto): Promise<any> {
    const sourceFramework = await this.frameworkRepository.findOne({
      where: { id: createMappingDto.sourceFrameworkId },
    });
    if (!sourceFramework) {
      throw new NotFoundException(`Source framework with ID ${createMappingDto.sourceFrameworkId} not found`);
    }

    const targetFramework = await this.frameworkRepository.findOne({
      where: { id: createMappingDto.targetFrameworkId },
    });
    if (!targetFramework) {
      throw new NotFoundException(`Target framework with ID ${createMappingDto.targetFrameworkId} not found`);
    }

    const mappingEntities = [];
    for (const mapping of createMappingDto.mappings) {
      const sourceControl = await this.controlRepository.findOne({
        where: { id: mapping.sourceControlId, frameworkId: createMappingDto.sourceFrameworkId },
      });
      if (!sourceControl) {
        throw new BadRequestException(`Source control ${mapping.sourceControlId} not found in framework`);
      }

      const targetControl = await this.controlRepository.findOne({
        where: { id: mapping.targetControlId, frameworkId: createMappingDto.targetFrameworkId },
      });
      if (!targetControl) {
        throw new BadRequestException(`Target control ${mapping.targetControlId} not found in framework`);
      }

      // For framework-to-framework mappings, we create a metadata record
      // In a real implementation, you might have a separate FrameworkMapping entity
      const mappingEntity = {
        id: `${mapping.sourceControlId}-${mapping.targetControlId}`,
        sourceFrameworkId: createMappingDto.sourceFrameworkId,
        targetFrameworkId: createMappingDto.targetFrameworkId,
        sourceControlId: mapping.sourceControlId,
        targetControlId: mapping.targetControlId,
        mappingType: mapping.mappingType || 'related',
        mappingStrength: mapping.confidence || 0.5,
        rationale: mapping.rationale,
        notes: createMappingDto.notes,
        status: MappingStatus.ACTIVE,
      };
      mappingEntities.push(mappingEntity);
    }

    // For now, return the mapping entities directly
    // In production, you'd save these to a FrameworkMapping table
    const savedMappings = mappingEntities;

    // Invalidate cache
    await this.cacheService.deleteByPattern('mapping:*');
    await this.cacheService.deleteByPattern(`framework:${createMappingDto.sourceFrameworkId}:*`);
    await this.cacheService.deleteByPattern(`framework:${createMappingDto.targetFrameworkId}:*`);

    // Emit event
    this.eventEmitter.emit('compliance.framework.mapped', {
      sourceFrameworkId: createMappingDto.sourceFrameworkId,
      targetFrameworkId: createMappingDto.targetFrameworkId,
      mappingCount: savedMappings.length,
      timestamp: new Date(),
    });

    return {
      sourceFramework: {
        id: sourceFramework.id,
        name: sourceFramework.name,
        version: sourceFramework.version,
      },
      targetFramework: {
        id: targetFramework.id,
        name: targetFramework.name,
        version: targetFramework.version,
      },
      mappings: savedMappings,
      totalMappings: savedMappings.length,
    };
  }

  // New CRUD methods
  async create(createMappingDto: CreateMappingDto | CreatePolicyControlMappingDto): Promise<any> {
    // Check if it's a framework mapping or policy-control mapping
    if ('sourceFrameworkId' in createMappingDto) {
      return this.createFrameworkMapping(createMappingDto as CreateMappingDto);
    } else {
      return this.createPolicyControlMappingInternal(createMappingDto as CreatePolicyControlMappingDto);
    }
  }

  private async createPolicyControlMappingInternal(createMappingDto: CreatePolicyControlMappingDto): Promise<ComplianceMapping> {
    // Validate policy exists
    const policy = await this.policyRepository.findOne({
      where: { id: createMappingDto.policyId },
    });
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${createMappingDto.policyId} not found`);
    }

    const controls = await this.controlRepository.find({
      where: { id: In(createMappingDto.controlIds) },
      relations: ['framework'],
    });
    if (controls.length !== createMappingDto.controlIds.length) {
      throw new BadRequestException('One or more control IDs are invalid');
    }

    // Create mappings for each control
    const mappings = [];
    for (const control of controls) {
      // Check if mapping already exists for this specific policy-control pair
      const existingMapping = await this.mappingRepository.findOne({
        where: {
          policyId: createMappingDto.policyId,
          controlId: control.id,
          deletedAt: IsNull(),
        },
      });

      if (existingMapping) {
        throw new ConflictException(`Mapping already exists for policy ${createMappingDto.policyId} and control ${control.id}`);
      }

      const mapping = this.mappingRepository.create({
        policyId: createMappingDto.policyId,
        controlId: control.id,
        frameworkId: control.frameworkId,
        organizationId: policy.organizationId,
        notes: createMappingDto.notes,
        status: MappingStatus.DRAFT,
        metadata: {
          createdAt: new Date(),
          controlIdentifier: control.identifier,
          policyNumber: policy.policyNumber,
        },
      });
      mappings.push(mapping);
    }

    const savedMappings = await this.mappingRepository.save(mappings);

    // Invalidate cache
    await this.cacheService.delete(`mapping:policy:${createMappingDto.policyId}`);
    for (const controlId of createMappingDto.controlIds) {
      await this.cacheService.delete(`mapping:control:${controlId}`);
    }
    await this.cacheService.deleteByPattern('mapping:*');

    // Emit event
    this.eventEmitter.emit('compliance.mapping.created', {
      mappingIds: savedMappings.map(m => m.id),
      policyId: createMappingDto.policyId,
      controlIds: createMappingDto.controlIds,
      timestamp: new Date(),
    });

    return savedMappings[0]; // Return first mapping for compatibility
  }

  async findAll(query: QueryMappingDto = {}): Promise<{ data: ComplianceMapping[]; total: number; page: number; limit: number; meta?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean; statistics?: any } }> {
    const { page = 1, limit = 50, search, policyId, controlId, frameworkId, includeStats } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.mappingRepository
      .createQueryBuilder('mapping')
      .leftJoinAndSelect('mapping.policy', 'policy')
      .leftJoinAndSelect('mapping.control', 'control')
      .leftJoinAndSelect('mapping.framework', 'framework')
      .where('mapping.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(policy.title ILIKE :search OR control.title ILIKE :search OR control.identifier ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (policyId) {
      queryBuilder.andWhere('mapping.policyId = :policyId', { policyId });
    }

    if (controlId) {
      queryBuilder.andWhere('mapping.controlId = :controlId', { controlId });
    }

    if (frameworkId) {
      queryBuilder.andWhere('mapping.frameworkId = :frameworkId', { frameworkId });
    }

    const [data, total] = await queryBuilder
      .orderBy('mapping.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    
    // Calculate statistics if requested
    let statistics;
    if (includeStats && data.length > 0) {
      // Calculate average confidence
      const confidences = data
        .filter(m => m.metadata?.confidence)
        .map(m => m.metadata.confidence);
      const averageConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;
      
      // Calculate coverage by framework
      const frameworkCoverage: Record<string, number> = {};
      const frameworkGroups = data.reduce((acc, mapping) => {
        const fwId = mapping.framework?.identifier || mapping.frameworkId;
        if (!acc[fwId]) acc[fwId] = [];
        acc[fwId].push(mapping);
        return acc;
      }, {} as Record<string, ComplianceMapping[]>);
      
      for (const [fwId, mappings] of Object.entries(frameworkGroups)) {
        const mapped = mappings.filter(m => m.status === 'approved' || m.status === 'active').length;
        frameworkCoverage[fwId] = mappings.length > 0 ? mapped / mappings.length : 0;
      }
      
      statistics = {
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        totalApproved: data.filter(m => m.status === 'approved').length,
        totalDraft: data.filter(m => m.status === 'draft').length,
        frameworkCoverage,
      };
    }
    
    return { 
      data, 
      total, 
      page, 
      limit,
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
  }

  async findOne(id: string): Promise<ComplianceMapping> {
    const mapping = await this.mappingRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['policy', 'control', 'framework'],
    });

    if (!mapping) {
      throw new NotFoundException(`Mapping with ID ${id} not found`);
    }

    return mapping;
  }

  async findByFrameworks(frameworkIds: string[]): Promise<ComplianceMapping[]> {
    return this.mappingRepository.find({
      where: {
        frameworkId: In(frameworkIds),
        deletedAt: IsNull(),
      },
      relations: ['policy', 'control', 'framework'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateMappingDto: UpdateMappingDto): Promise<ComplianceMapping> {
    const mapping = await this.findOne(id);

    if (updateMappingDto.notes !== undefined) {
      mapping.notes = updateMappingDto.notes;
    }

    mapping.updatedAt = new Date();
    const saved = await this.mappingRepository.save(mapping);

    // Invalidate cache
    await this.cacheService.delete(`mapping:${id}`);
    await this.cacheService.delete(`mapping:policy:${mapping.policyId}`);
    await this.cacheService.delete(`mapping:control:${mapping.controlId}`);
    await this.cacheService.deleteByPattern('mapping:*');

    // Emit event
    this.eventEmitter.emit('compliance.mapping.updated', {
      mappingId: id,
      changes: updateMappingDto,
      timestamp: new Date(),
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const mapping = await this.findOne(id);

    await this.mappingRepository.softDelete(id);

    // Invalidate cache
    await this.cacheService.delete(`mapping:${id}`);
    await this.cacheService.delete(`mapping:policy:${mapping.policyId}`);
    await this.cacheService.delete(`mapping:control:${mapping.controlId}`);
    await this.cacheService.deleteByPattern('mapping:*');

    // Emit event
    this.eventEmitter.emit('compliance.mapping.deleted', {
      mappingId: id,
      policyId: mapping.policyId,
      controlId: mapping.controlId,
      timestamp: new Date(),
    });
  }

  async createPolicyControlMapping(dto: CreatePolicyControlMappingDto): Promise<any> {
    return this.mapPolicyToControls(dto.policyId, dto.controlIds);
  }

  async createBulk(mappings: CreatePolicyControlMappingDto[]): Promise<{ success: number; failed: number; errors: any[]; results?: any[] }> {
    return this.bulkCreate(mappings);
  }

  async bulkCreate(mappings: CreatePolicyControlMappingDto[]): Promise<{ success: number; failed: number; errors: any[]; results?: any[] }> {
    const output = {
      success: 0,
      failed: 0,
      errors: [],
      results: [],
    };

    for (const mappingDto of mappings) {
      try {
        const mapping = await this.create(mappingDto);
        output.success++;
        output.results.push(mapping);
      } catch (error) {
        output.failed++;
        output.errors.push({
          policyId: mappingDto.policyId,
          controlIds: mappingDto.controlIds,
          error: error.message,
        });
      }
    }

    // Invalidate all mapping cache
    await this.cacheService.deleteByPattern('mapping:*');

    this.logger.log(
      `Bulk mapping creation completed: ${output.success} succeeded, ${output.failed} failed`
    );

    return output;
  }

  async getMappingStatistics(organizationId?: string): Promise<any> {
    const cacheKey = this.cacheService.buildKey('mapping', 'statistics', organizationId || 'all');

    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate statistics
    const result = await (async () => {
        const whereClause: any = { deletedAt: IsNull() };
        if (organizationId) {
          whereClause.organizationId = organizationId;
        }

        const totalMappings = await this.mappingRepository.count({ where: whereClause });
        const activeMappings = await this.mappingRepository.count({
          where: { ...whereClause, status: MappingStatus.ACTIVE },
        });
        const approvedMappings = await this.mappingRepository.count({
          where: { ...whereClause, status: MappingStatus.APPROVED },
        });

        // Get mappings by framework
        const byFramework = await this.mappingRepository
          .createQueryBuilder('mapping')
          .leftJoinAndSelect('mapping.framework', 'framework')
          .select(['framework.name', 'COUNT(mapping.id) as count'])
          .where('mapping.deletedAt IS NULL')
          .andWhere(organizationId ? 'mapping.organizationId = :orgId' : '1=1', { orgId: organizationId })
          .groupBy('framework.id, framework.name')
          .getRawMany();

        return {
          total: totalMappings,
          active: activeMappings,
          approved: approvedMappings,
          draft: totalMappings - activeMappings - approvedMappings,
          byFramework,
          averageControlsPerPolicy: totalMappings > 0 ? Math.round((totalMappings / await this.getUniquePolicyCount(organizationId)) * 100) / 100 : 0,
        };
    })();

    // Cache result for 5 minutes
    await this.cacheService.set(cacheKey, result, { ttl: 300 });
    return result;
  }

  async getMappingCoverage(frameworkId?: string): Promise<any> {
    const cacheKey = this.cacheService.buildKey('mapping', 'coverage', frameworkId || 'all');

    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate coverage
    const result = await (async () => {
        const whereClause: any = {};
        if (frameworkId) {
          whereClause.frameworkId = frameworkId;
        }

        const totalControls = await this.controlRepository.count({ where: whereClause });
        const mappedControls = await this.mappingRepository
          .createQueryBuilder('mapping')
          .where('mapping.deletedAt IS NULL')
          .andWhere(frameworkId ? 'mapping.frameworkId = :frameworkId' : '1=1', { frameworkId })
          .distinctOn(['mapping.controlId'])
          .getCount();

        const coverage = totalControls > 0 ? (mappedControls / totalControls) * 100 : 0;

        return {
          totalControls,
          mappedControls,
          unmappedControls: totalControls - mappedControls,
          coveragePercentage: Math.round(coverage * 100) / 100,
        };
    })();

    // Cache result for 5 minutes
    await this.cacheService.set(cacheKey, result, { ttl: 300 });
    return result;
  }

  async validateMapping(id: string): Promise<{ valid: boolean; issues: string[]; errors?: Array<{ field: string; message: string }> }> {
    const mapping = await this.findOne(id);
    const issues = [];

    // Check if policy exists and is active
    const policy = await this.policyRepository.findOne({
      where: { id: mapping.policyId },
    });
    if (!policy) {
      issues.push('Associated policy not found');
    } else if (policy.status !== PolicyStatus.EFFECTIVE) {
      issues.push('Associated policy is not effective');
    }

    // Check if control exists and is active
    const control = await this.controlRepository.findOne({
      where: { id: mapping.controlId },
    });
    if (!control) {
      issues.push('Associated control not found');
    } else if (control.implementationStatus === 'not_applicable') {
      issues.push('Associated control is marked as not applicable');
    }

    // Check for duplicate mappings
    const duplicates = await this.mappingRepository.count({
      where: {
        policyId: mapping.policyId,
        controlId: mapping.controlId,
        id: Not(mapping.id),
        deletedAt: IsNull(),
      },
    });
    if (duplicates > 0) {
      issues.push('Duplicate mapping exists');
    }

    const errors = issues.map((issue, index) => ({
      field: `issue_${index}`,
      message: issue,
    }));

    return {
      valid: issues.length === 0,
      issues,
      errors: issues.length > 0 ? errors : undefined,
    };
  }

  async exportMappings(format: string): Promise<any> {
    const mappings = await this.mappingRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['policy', 'control', 'framework'],
      order: { createdAt: 'DESC' },
    });

    switch (format.toLowerCase()) {
      case 'json':
        return {
          format: 'json',
          data: mappings,
          exportedAt: new Date(),
          count: mappings.length,
        };
      case 'csv': {
        const csvData = mappings.map(m => ({
          'Mapping ID': m.id,
          'Policy Number': m.policy?.policyNumber || '',
          'Policy Title': m.policy?.title || '',
          'Control Identifier': m.control?.identifier || '',
          'Control Title': m.control?.title || '',
          'Framework': m.framework?.name || '',
          'Status': m.status,
          'Notes': m.notes || '',
          'Created At': m.createdAt.toISOString(),
        }));
        return {
          format: 'csv',
          data: csvData,
          exportedAt: new Date(),
          count: mappings.length,
        };
      }
      default:
        throw new BadRequestException('Unsupported export format. Use json or csv.');
    }
  }

  async importMappings(data: string, format: string): Promise<{ imported: number; errors: any[] }> {
    const result = { imported: 0, errors: [] };

    try {
      let mappingsData;
      switch (format.toLowerCase()) {
        case 'json':
          mappingsData = JSON.parse(data);
          break;
        default:
          throw new BadRequestException('Unsupported import format. Use json.');
      }

      if (!Array.isArray(mappingsData)) {
        throw new BadRequestException('Data must be an array of mappings');
      }

      for (const mappingData of mappingsData) {
        try {
          const createDto: CreatePolicyControlMappingDto = {
            policyId: mappingData.policyId,
            controlIds: Array.isArray(mappingData.controlIds) ? mappingData.controlIds : [mappingData.controlId],
            notes: mappingData.notes,
          };
          await this.create(createDto);
          result.imported++;
        } catch (error) {
          result.errors.push({
            data: mappingData,
            error: error.message,
          });
        }
      }
    } catch (error) {
      throw new BadRequestException(`Import failed: ${error.message}`);
    }

    return result;
  }

  async getMappingGaps(frameworkId?: string): Promise<any> {
    const whereClause: any = {};
    if (frameworkId) {
      whereClause.frameworkId = frameworkId;
    }

    // Get all controls
    const allControls = await this.controlRepository.find({
      where: whereClause,
      relations: ['framework'],
    });

    // Get mapped control IDs
    const mappedControlIds = await this.mappingRepository
      .createQueryBuilder('mapping')
      .select('DISTINCT mapping.controlId')
      .where('mapping.deletedAt IS NULL')
      .andWhere(frameworkId ? 'mapping.frameworkId = :frameworkId' : '1=1', { frameworkId })
      .getRawMany()
      .then(results => results.map(r => r.controlId));

    // Find unmapped controls
    const unmappedControls = allControls.filter(control => !mappedControlIds.includes(control.id));

    return {
      totalControls: allControls.length,
      mappedControls: mappedControlIds.length,
      unmappedControls: unmappedControls.length,
      gaps: unmappedControls.map(control => ({
        id: control.id,
        identifier: control.identifier,
        title: control.title,
        category: control.category,
        priority: control.priority,
        framework: {
          id: control.framework.id,
          name: control.framework.name,
        },
      })),
    };
  }

  async getMappingConflicts(): Promise<any> {
    // Find policies mapped to conflicting controls (same requirement different frameworks)
    const conflicts = await this.mappingRepository
      .createQueryBuilder('m1')
      .innerJoin('compliance_mappings', 'm2', 'm1.policyId = m2.policyId AND m1.id != m2.id')
      .leftJoinAndSelect('m1.policy', 'policy')
      .leftJoinAndSelect('m1.control', 'c1')
      .leftJoinAndSelect('m1.framework', 'f1')
      .leftJoin('control', 'c2', 'm2.controlId = c2.id')
      .leftJoin('compliance_framework', 'f2', 'm2.frameworkId = f2.id')
      .where('m1.deletedAt IS NULL AND m2.deletedAt IS NULL')
      .andWhere('f1.id != f2.id') // Different frameworks
      .select([
        'm1.id',
        'm1.policyId',
        'policy.policyNumber',
        'policy.title',
        'c1.identifier',
        'c1.title',
        'f1.name',
      ])
      .getMany();

    return {
      conflicts: conflicts.length,
      details: conflicts,
    };
  }

  async approveMappings(ids: string[], approvalData: { approvedBy: string; comments?: string }): Promise<any> {
    // First get the mappings to preserve existing metadata
    const mappings = await this.mappingRepository.find({ where: { id: In(ids) } });
    
    const results = [];
    let approved = 0;
    let failed = 0;
    const errors = [];
    
    // Update each mapping individually to preserve metadata
    for (const mapping of mappings) {
      try {
        if (mapping.status === MappingStatus.APPROVED) {
          results.push({ id: mapping.id, success: false, error: 'Already approved' });
          failed++;
          errors.push(`Mapping ${mapping.id} is already approved`);
        } else {
          await this.mappingRepository.update(
            mapping.id,
            {
              status: MappingStatus.APPROVED,
              approvedBy: approvalData.approvedBy,
              approvedAt: new Date(),
              metadata: approvalData.comments ? {
                ...mapping.metadata,
                approvalComments: approvalData.comments,
              } : mapping.metadata,
            }
          );
          results.push({ id: mapping.id, success: true });
          approved++;
        }
      } catch (error) {
        results.push({ id: mapping.id, success: false, error: error.message });
        failed++;
        errors.push(error.message);
      }
    }

    // Invalidate cache
    await this.cacheService.deleteByPattern('mapping:*');

    // Emit event
    this.eventEmitter.emit('compliance.mappings.approved', {
      mappingIds: ids,
      approvedBy: approvalData.approvedBy,
      timestamp: new Date(),
    });
    
    return {
      approved,
      failed,
      errors,
      results,
    };
  }

  async rejectMappings(ids: string[], rejectionData: { rejectedBy: string; reason: string }): Promise<any> {
    const results = [];
    let rejected = 0;
    let failed = 0;
    const errors = [];
    
    // Get mappings to check their status
    const mappings = await this.mappingRepository.find({ where: { id: In(ids) } });
    
    for (const mapping of mappings) {
      try {
        if (mapping.status === MappingStatus.REJECTED) {
          results.push({ id: mapping.id, success: false, error: 'Already rejected' });
          failed++;
          errors.push(`Mapping ${mapping.id} is already rejected`);
        } else {
          await this.mappingRepository.update(
            mapping.id,
            {
              status: MappingStatus.REJECTED,
              rejectedBy: rejectionData.rejectedBy,
              rejectedAt: new Date(),
              rejectionReason: rejectionData.reason,
            }
          );
          results.push({ id: mapping.id, success: true });
          rejected++;
        }
      } catch (error) {
        results.push({ id: mapping.id, success: false, error: error.message });
        failed++;
        errors.push(error.message);
      }
    }

    // Invalidate cache
    await this.cacheService.deleteByPattern('mapping:*');

    // Emit event
    this.eventEmitter.emit('compliance.mappings.rejected', {
      mappingIds: ids,
      rejectedBy: rejectionData.rejectedBy,
      reason: rejectionData.reason,
      timestamp: new Date(),
    });
    
    return {
      rejected,
      failed,
      errors,
      results,
    };
  }

  // Helper methods
  private async getUniquePolicyCount(organizationId?: string): Promise<number> {
    const whereClause: any = { deletedAt: IsNull() };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    return this.mappingRepository
      .createQueryBuilder('mapping')
      .select('COUNT(DISTINCT mapping.policyId)', 'count')
      .where(whereClause)
      .getRawOne()
      .then(result => parseInt(result.count) || 0);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use NLP library
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be'];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .filter((word, index, self) => self.indexOf(word) === index); // unique
  }
}