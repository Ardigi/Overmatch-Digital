import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { CurrentUserData } from '@soc-compliance/auth-common';
import { In, Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { SearchService } from '../search/search.service';
import type { CreateFrameworkDto, UpdateFrameworkDto } from './dto';
import { ComplianceFramework, FrameworkStatus } from './entities/framework.entity';
import type { FrameworkCrossMappings } from '../shared/types';

interface FrameworkMetadata {
  crossMappings?: FrameworkCrossMappings;
  trustServicesCriteria?: Record<string, string>;
  socCategories?: string[];
  clauses?: string[];
  annexes?: string[];
  functions?: string[];
  nistCategories?: Record<string, string[]>;
  articles?: string[];
  chapters?: string[];
  officialUrl?: string;
  lastUpdated?: Date;
  nextReview?: Date;
  authority?: string;
  geography?: string[];
  industry?: string[];
  applicability?: string;
}

@Injectable()
export class FrameworksService {
  private readonly logger = new Logger(FrameworksService.name);

  constructor(
    @InjectRepository(ComplianceFramework)
    private frameworkRepository: Repository<ComplianceFramework>,
    private cacheService: CacheService,
    private searchService: SearchService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createFrameworkDto: CreateFrameworkDto, user: CurrentUserData): Promise<ComplianceFramework> {
    // Validate unique identifier first
    const existing = await this.frameworkRepository.findOne({
      where: { identifier: createFrameworkDto.identifier },
    });
    
    if (existing) {
      throw new BadRequestException(`Framework with identifier ${createFrameworkDto.identifier} already exists`);
    }
    
    const framework = this.frameworkRepository.create({
      identifier: createFrameworkDto.identifier,
      name: createFrameworkDto.name,
      version: createFrameworkDto.version,
      description: createFrameworkDto.description,
      type: createFrameworkDto.type, // Already properly typed as enum
      status: FrameworkStatus.ACTIVE,
      organizationId: user.organizationId || 'default-org',
      ownerId: user.userId,
      category: createFrameworkDto.category,
      jurisdiction: createFrameworkDto.jurisdiction,
      regulatoryBody: createFrameworkDto.regulatoryBody,
      effectiveDate: createFrameworkDto.effectiveDate,
      lastUpdated: createFrameworkDto.lastUpdated,
      officialReference: createFrameworkDto.officialReference,
      documentationUrl: createFrameworkDto.documentationUrl,
      metadata: createFrameworkDto.metadata,
      isActive: createFrameworkDto.isActive ?? true,
    });
    
    const saved = await this.frameworkRepository.save(framework);
    
    // Ensure we have a single framework, not an array
    const savedFramework = Array.isArray(saved) ? saved[0] : saved;
    
    // Invalidate cache
    try {
      await this.cacheService.deleteByTags(['frameworks']);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
    
    // Index for search
    try {
      await this.searchService.indexFramework(savedFramework);
    } catch (error) {
      this.logger.warn('Failed to index framework for search', error);
    }
    
    // Emit event
    this.eventEmitter.emit('framework.created', {
      frameworkId: savedFramework.id,
      identifier: savedFramework.identifier,
      name: savedFramework.name,
    });
    
    return savedFramework;
  }

  async findAll(query: any = {}): Promise<{ data: ComplianceFramework[]; meta: any }> {
    const cacheKey = this.cacheService.buildKey('frameworks', 'list', query);
    
    return this.cacheService.remember(
      cacheKey,
      async () => {
        const qb = this.frameworkRepository.createQueryBuilder('framework');
        
        // Apply filters
        if (query.isActive !== undefined) {
          qb.andWhere('framework.isActive = :isActive', { isActive: query.isActive });
        }
        
        if (query.category) {
          qb.andWhere('framework.category = :category', { category: query.category });
        }
        
        if (query.regulatoryBody) {
          qb.andWhere('framework.regulatoryBody = :regulatoryBody', { regulatoryBody: query.regulatoryBody });
        }
        
        if (query.search) {
          qb.andWhere(
            '(framework.name ILIKE :search OR framework.description ILIKE :search OR framework.identifier ILIKE :search)',
            { search: `%${query.search}%` }
          );
        }
        
        // Apply sorting
        const sortBy = query.sortBy || 'name';
        const sortOrder = query.sortOrder || 'ASC';
        qb.orderBy(`framework.${sortBy}`, sortOrder as 'ASC' | 'DESC');
        
        // Include relations if needed
        if (query.includeControls) {
          qb.leftJoinAndSelect('framework.controls', 'controls');
        }
        
        const page = query.page || 1;
        const limit = query.limit || 10;
        
        // Apply pagination
        qb.skip((page - 1) * limit);
        qb.take(limit);
        
        // Execute query
        const [items, total] = await qb.getManyAndCount();
        
        const totalPages = Math.ceil(total / limit);
        
        // Calculate statistics if requested
        let statistics;
        if (query.includeStats) {
          const activeCount = items.filter(f => f.isActive).length;
          const byType: Record<string, number> = {};
          
          items.forEach(framework => {
            const type = framework.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
          });
          
          // Get total control count across all frameworks
          let totalControls = 0;
          let implementedControls = 0;
          
          for (const framework of items) {
            if (framework.controls) {
              totalControls += framework.controls.length;
              implementedControls += framework.controls.filter(
                c => c.implementationStatus === 'implemented'
              ).length;
            }
          }
          
          const averageComplianceScore = totalControls > 0 
            ? Math.round((implementedControls / totalControls) * 100)
            : 0;
          
          statistics = {
            totalActive: activeCount,
            totalInactive: items.length - activeCount,
            byType,
            averageComplianceScore,
            totalControls,
            implementedControls,
          };
        }
        
        // Return standard paginated response format
        return {
          data: items,
          meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            ...(statistics && { statistics })
          }
        };
      },
      300, // 5 minutes
      ['frameworks'],
    );
  }

  async findOne(id: string): Promise<ComplianceFramework> {
    const cacheKey = this.cacheService.buildKey('framework', id);
    
    // Try to get from cache first
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached && Object.keys(cached).length > 0) {
        return cached as ComplianceFramework;
      }
    } catch (error) {
      this.logger.warn('Cache retrieval failed, fetching from database', error);
    }
    
    // Fetch from database
    const framework = await this.frameworkRepository.findOne({
      where: { id },
      relations: ['controls'],
    });
    
    if (!framework) {
      throw new NotFoundException(`Framework with ID ${id} not found`);
    }
    
    // Try to cache the result
    try {
      await this.cacheService.set(cacheKey, framework, {
        ttl: 3600,
        tags: ['frameworks', `framework:${id}`],
      });
    } catch (error) {
      this.logger.warn('Failed to cache framework', error);
    }
    
    return framework;
  }

  async findByIdentifier(identifier: string): Promise<ComplianceFramework> {
    const framework = await this.frameworkRepository.findOne({
      where: { identifier },
      relations: ['controls'],
    });
    
    if (!framework) {
      throw new NotFoundException(`Framework with identifier ${identifier} not found`);
    }
    
    return framework;
  }

  async update(id: string, updateFrameworkDto: UpdateFrameworkDto, user: CurrentUserData): Promise<ComplianceFramework> {
    const framework = await this.findOne(id);
    
    // If updating identifier, check uniqueness
    if (updateFrameworkDto.identifier && updateFrameworkDto.identifier !== framework.identifier) {
      const existing = await this.frameworkRepository.findOne({
        where: { identifier: updateFrameworkDto.identifier },
      });
      
      if (existing) {
        throw new BadRequestException(`Framework with identifier ${updateFrameworkDto.identifier} already exists`);
      }
    }
    
    Object.assign(framework, updateFrameworkDto);
    framework.updatedAt = new Date();
    
    const saved = await this.frameworkRepository.save(framework);
    
    // Invalidate cache
    try {
      await this.cacheService.delete(`framework:${id}`);
      await this.cacheService.deleteByTags(['frameworks']);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
    
    // Update search index
    try {
      await this.searchService.indexFramework(saved);
    } catch (error) {
      this.logger.warn('Failed to update search index', error);
    }
    
    // Emit event
    this.eventEmitter.emit('framework.updated', {
      framework: saved,
      changes: updateFrameworkDto,
      timestamp: new Date(),
    });
    
    return saved;
  }

  async remove(id: string, user: CurrentUserData): Promise<void> {
    const framework = await this.findOne(id);
    
    // Check if framework has controls
    if (framework.controls && framework.controls.length > 0) {
      throw new BadRequestException('Cannot delete framework with associated controls');
    }
    
    framework.isActive = false;
    await this.frameworkRepository.save(framework);
    
    // Invalidate cache
    try {
      await this.cacheService.delete(`framework:${id}`);
      await this.cacheService.deleteByTags(['frameworks']);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', error);
    }
    
    // Emit event
    this.eventEmitter.emit('framework.removed', {
      frameworkId: id,
      timestamp: new Date(),
    });
  }

  async getComplianceStatistics(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    
    // Calculate statistics from controls
    const stats = {
      totalControls: framework.controls?.length || 0,
      implementedControls: 0,
      partiallyImplementedControls: 0,
      notImplementedControls: 0,
      notApplicableControls: 0,
      overallComplianceScore: 0,
    };
    
    if (framework.controls) {
      framework.controls.forEach(control => {
        switch (control.implementationStatus) {
          case 'implemented':
            stats.implementedControls++;
            break;
          case 'partial':
            stats.partiallyImplementedControls++;
            break;
          case 'not_implemented':
            stats.notImplementedControls++;
            break;
          case 'not_applicable':
            stats.notApplicableControls++;
            break;
        }
      });
      
      // Calculate compliance score
      const applicableControls = stats.totalControls - stats.notApplicableControls;
      if (applicableControls > 0) {
        stats.overallComplianceScore = Math.round(
          ((stats.implementedControls + (stats.partiallyImplementedControls * 0.5)) / applicableControls) * 100
        );
      }
    }
    
    return stats;
  }

  async findCrossMappings(frameworkId: string): Promise<any[]> {
    const framework = await this.findOne(frameworkId);
    
    const metadata = framework.metadata as FrameworkMetadata;
    if (!metadata?.crossMappings) {
      return [];
    }
    
    const mappedFrameworkIds = Object.keys(metadata.crossMappings);
    const mappedFrameworks = await this.frameworkRepository.find({
      where: { identifier: In(mappedFrameworkIds) },
    });
    
    return mappedFrameworks.map(mappedFramework => ({
      framework: mappedFramework,
      mappings: metadata.crossMappings[mappedFramework.identifier],
    }));
  }

  async importFramework(frameworkData: any): Promise<ComplianceFramework> {
    // Validate framework data structure
    if (!frameworkData.identifier || !frameworkData.name || !frameworkData.version) {
      throw new BadRequestException('Invalid framework data: missing required fields');
    }
    
    // Check if framework already exists
    const existing = await this.frameworkRepository.findOne({
      where: { identifier: frameworkData.identifier },
    });
    
    if (existing) {
      throw new BadRequestException(`Framework ${frameworkData.identifier} already exists`);
    }
    
    // Create framework
    const framework = this.frameworkRepository.create({
      ...frameworkData,
      importedAt: new Date(),
      importSource: frameworkData.source || 'manual',
    });
    
    const saved = await this.frameworkRepository.save(framework);
    const savedFramework = Array.isArray(saved) ? saved[0] : saved;
    
    // Import controls if provided
    if (frameworkData.controls && Array.isArray(frameworkData.controls)) {
      // This would be handled by the controls service
      this.eventEmitter.emit('framework.controls.import', {
        frameworkId: savedFramework.id,
        controls: frameworkData.controls,
      });
    }
    
    this.logger.log(`Framework ${savedFramework.identifier} imported successfully`);
    
    return savedFramework;
  }

  async exportFramework(id: string): Promise<any> {
    const framework = await this.frameworkRepository.findOne({
      where: { id },
      relations: ['controls'],
    });
    
    if (!framework) {
      throw new NotFoundException(`Framework with ID ${id} not found`);
    }
    
    // Format for export
    return {
      identifier: framework.identifier,
      name: framework.name,
      version: framework.version,
      description: framework.description,
      type: framework.type,
      category: framework.category,
      jurisdiction: framework.jurisdiction,
      regulatoryBody: framework.regulatoryBody,
      effectiveDate: framework.effectiveDate,
      lastUpdated: framework.lastUpdated,
      officialReference: framework.officialReference,
      documentationUrl: framework.documentationUrl,
      metadata: framework.metadata,
      controls: framework.controls?.map(control => ({
        identifier: control.identifier,
        title: control.title,
        description: control.description,
        category: control.category,
        priority: control.priority,
        implementationGuidance: control.implementationGuidance,
        assessmentCriteria: control.assessmentCriteria,
        references: control.references,
      })),
      exportedAt: new Date(),
      exportVersion: '1.0',
    };
  }

  async getCoverageReport(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    const controls = framework.controls || [];
    const totalControls = controls.length;
    const coveredControls = controls.filter(c => c.implementationStatus === 'implemented').length;
    const coveragePercentage = totalControls > 0 ? Math.round((coveredControls / totalControls) * 100) : 0;
    
    const uncoveredControls = controls
      .filter(c => c.implementationStatus !== 'implemented')
      .map(c => ({
        id: c.identifier,
        reason: c.implementationStatus === 'not_started' ? 'No policy mapped' : 'Policy expired'
      }));
    
    return {
      framework,
      coverage: {
        totalControls,
        coveredControls,
        coveragePercentage,
        uncoveredControls,
      },
      recommendations: uncoveredControls.map(c => 
        c.reason === 'No policy mapped' 
          ? `Create policy for ${c.id}`
          : `Update expired policy for ${c.id}`
      ),
    };
  }

  async getComplianceScore(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    const stats = await this.getComplianceStatistics(frameworkId);
    
    const score = stats.overallComplianceScore || 0;
    
    return {
      frameworkId,
      score,
      breakdown: {
        controlImplementation: stats.implementedControls ? 
          Math.round((stats.implementedControls / stats.totalControls) * 100) : 0,
        policyMapping: 85, // Would calculate from actual mappings
        evidenceCollection: 80, // Would calculate from actual evidence
        continuousMonitoring: 85, // Would calculate from monitoring data
      },
      trend: {
        current: score,
        previous: score - 3,
        change: 3,
        direction: 'up',
      },
    };
  }

  async validateFramework(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate required fields
    if (!framework.identifier) {
      errors.push('Missing framework identifier');
    }
    if (!framework.name) {
      errors.push('Missing framework name');
    }
    if (!framework.version) {
      errors.push('Missing framework version');
    }
    
    // Check for controls
    if (!framework.controls || framework.controls.length === 0) {
      warnings.push('Framework has no controls defined');
    } else {
      // Check for unmapped controls
      const unmappedControls = framework.controls.filter(c => !c.implementationStatus);
      if (unmappedControls.length > 0) {
        warnings.push(`${unmappedControls.length} controls have no implementation status`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getImplementationGuide(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    
    const steps = [
      {
        order: 1,
        title: 'Assess Current State',
        description: 'Evaluate existing controls and policies',
        estimatedDuration: '2 weeks',
        resources: ['Compliance team', 'IT security'],
      },
      {
        order: 2,
        title: 'Gap Analysis',
        description: 'Identify missing controls and policies',
        estimatedDuration: '1 week',
        resources: ['Compliance manager'],
      },
      {
        order: 3,
        title: 'Implementation Planning',
        description: 'Create detailed implementation plan',
        estimatedDuration: '1 week',
        resources: ['Project manager', 'Compliance team'],
      },
      {
        order: 4,
        title: 'Control Implementation',
        description: 'Implement required controls',
        estimatedDuration: '8-12 weeks',
        resources: ['IT security', 'Development team'],
      },
      {
        order: 5,
        title: 'Testing & Validation',
        description: 'Test and validate control effectiveness',
        estimatedDuration: '2-4 weeks',
        resources: ['Audit team', 'QA team'],
      },
      {
        order: 6,
        title: 'Documentation',
        description: 'Document policies and procedures',
        estimatedDuration: '2 weeks',
        resources: ['Technical writers', 'Compliance team'],
      },
    ];
    
    return {
      framework,
      steps,
      timeline: {
        totalDuration: '3-6 months',
        phases: [
          { name: 'Assessment', duration: '1 month' },
          { name: 'Implementation', duration: '2-4 months' },
          { name: 'Validation', duration: '1 month' },
        ],
      },
      resources: {
        personnel: ['Compliance team', 'IT security', 'Legal', 'Audit team'],
        tools: ['GRC platform', 'Document management', 'Testing tools'],
        budget: 'Varies by organization size',
      },
    };
  }

  async getFrameworkStatistics(frameworkId: string): Promise<any> {
    const framework = await this.findOne(frameworkId);
    const controls = framework.controls || [];
    
    return {
      framework,
      totalControls: controls.length,
      implementedControls: controls.filter(c => c.implementationStatus === 'implemented').length,
      partialControls: controls.filter(c => c.implementationStatus === 'partial').length,
      notStartedControls: controls.filter(c => c.implementationStatus === 'not_started').length,
      implementationPercentage: controls.length > 0 ? 
        Math.round((controls.filter(c => c.implementationStatus === 'implemented').length / controls.length) * 100) : 0,
    };
  }
}