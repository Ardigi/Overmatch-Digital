import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { CacheService } from '@soc-compliance/cache-common';
import { NotificationRule, NotificationRuleType } from './entities/notification-rule.entity';
import { NotificationRuleHistory } from './entities/notification-rule-history.entity';
import { RuleEvaluationMetrics } from './entities/rule-evaluation-metrics.entity';
import { EventNotificationMapping } from './entities/event-notification-mapping.entity';
import { 
  CreateNotificationRuleDto, 
  UpdateNotificationRuleDto, 
  EvaluateRuleDto,
  RuleFilterDto,
  RuleSortBy 
} from './dto';

@Injectable()
export class NotificationRulesService {
  private readonly logger = new Logger(NotificationRulesService.name);

  constructor(
    @InjectRepository(NotificationRule)
    private readonly ruleRepository: Repository<NotificationRule>,
    @InjectRepository(NotificationRuleHistory)
    private readonly historyRepository: Repository<NotificationRuleHistory>,
    @InjectRepository(RuleEvaluationMetrics)
    private readonly metricsRepository: Repository<RuleEvaluationMetrics>,
    @InjectRepository(EventNotificationMapping)
    private readonly mappingRepository: Repository<EventNotificationMapping>,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    createDto: CreateNotificationRuleDto & { organizationId: string; createdBy: string },
  ): Promise<NotificationRule> {
    // Check if rule with same name already exists
    const existing = await this.ruleRepository.findOne({
      where: {
        organizationId: createDto.organizationId,
        name: createDto.name,
      },
    });

    if (existing) {
      throw new ConflictException(`Rule with name '${createDto.name}' already exists`);
    }

    const rule = this.ruleRepository.create({
      ...createDto,
      isActive: createDto.enabled ?? true,
      enabled: createDto.enabled ?? true,
      priority: createDto.priority ?? 100,
    } as any);

    const savedRule = await this.ruleRepository.save(rule);

    // Create initial history entry
    const finalRule = Array.isArray(savedRule) ? savedRule[0] : savedRule;
    await this.createHistoryEntry(finalRule, 'created', createDto.createdBy);

    // Invalidate cache
    await this.invalidateRuleCache(createDto.organizationId);

    return finalRule;
  }

  async findAll(
    filterDto: RuleFilterDto,
  ): Promise<{ data: NotificationRule[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.ruleRepository
      .createQueryBuilder('rule')
      .where('rule.organizationId = :organizationId', { organizationId: filterDto.organizationId });

    if (filterDto.eventType) {
      queryBuilder.andWhere('rule.eventType = :eventType', {
        eventType: filterDto.eventType,
      });
    }

    if (filterDto.eventCategory) {
      queryBuilder.andWhere('rule.eventCategory = :eventCategory', {
        eventCategory: filterDto.eventCategory,
      });
    }

    if (filterDto.enabled !== undefined) {
      queryBuilder.andWhere('rule.enabled = :enabled', {
        enabled: filterDto.enabled,
      });
    }

    if (filterDto.name) {
      queryBuilder.andWhere('rule.name ILIKE :name', { name: `%${filterDto.name}%` });
    }

    if (filterDto.tags && filterDto.tags.length > 0) {
      queryBuilder.andWhere('rule.tags && :tags', { tags: filterDto.tags });
    }

    if (filterDto.activeOnly) {
      const now = new Date();
      queryBuilder.andWhere(
        '(rule.startDate IS NULL OR rule.startDate <= :now) AND (rule.endDate IS NULL OR rule.endDate >= :now)',
        { now }
      );
    }

    // Apply sorting
    const sortField = this.mapSortField(filterDto.sortBy || RuleSortBy.PRIORITY);
    queryBuilder.orderBy(`rule.${sortField}`, filterDto.sortOrder || 'ASC');

    const [data, total] = await queryBuilder
      .skip((filterDto.page - 1) * filterDto.limit)
      .take(filterDto.limit)
      .getManyAndCount();

    return { 
      data, 
      total,
      page: filterDto.page,
      limit: filterDto.limit,
    };
  }

  private mapSortField(sortBy: RuleSortBy): string {
    switch (sortBy) {
      case RuleSortBy.NAME:
        return 'name';
      case RuleSortBy.CREATED_AT:
        return 'createdAt';
      case RuleSortBy.UPDATED_AT:
        return 'updatedAt';
      case RuleSortBy.PRIORITY:
        return 'priority';
      case RuleSortBy.EVENT_TYPE:
        return 'eventType';
      default:
        return 'priority';
    }
  }

  async findOne(id: string, organizationId: string): Promise<NotificationRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, organizationId },
      relations: ['history', 'metrics'],
    });

    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    return rule;
  }

  async findByRuleId(organizationId: string, ruleId: string): Promise<NotificationRule> {
    const rule = await this.ruleRepository.findOne({
      where: { organizationId, ruleId },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID '${ruleId}' not found`);
    }

    return rule;
  }

  async update(
    id: string,
    updateDto: UpdateNotificationRuleDto & { organizationId: string; updatedBy: string },
  ): Promise<NotificationRule> {
    const rule = await this.findOne(id, updateDto.organizationId);

    // Create history entry for changes
    await this.createHistoryEntry(rule, 'updated', updateDto.updatedBy, updateDto);

    Object.assign(rule, {
      ...updateDto,
      version: (rule.version || 0) + 1,
    });

    const savedRule = await this.ruleRepository.save(rule);

    // Invalidate cache
    await this.invalidateRuleCache(updateDto.organizationId);

    return savedRule;
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const rule = await this.findOne(id, organizationId);
    await this.ruleRepository.remove(rule);
    await this.invalidateRuleCache(organizationId);
  }

  async setEnabled(id: string, enabled: boolean, organizationId: string): Promise<NotificationRule> {
    const rule = await this.findOne(id, organizationId);
    rule.enabled = enabled;
    const savedRule = await this.ruleRepository.save(rule);
    await this.invalidateRuleCache(organizationId);
    return savedRule;
  }

  async clone(
    id: string,
    organizationId: string,
    options: { name?: string; enabled?: boolean; createdBy: string },
  ): Promise<NotificationRule> {
    const original = await this.findOne(id, organizationId);
    
    const cloned = this.ruleRepository.create({
      ...original,
      id: undefined,
      name: options.name || `${original.name} (Copy)`,
      enabled: options.enabled ?? false,
      createdBy: options.createdBy,
      createdAt: undefined,
      updatedAt: undefined,
      version: 1,
    });

    const savedRule = await this.ruleRepository.save(cloned);
    await this.createHistoryEntry(savedRule, 'cloned', options.createdBy);
    await this.invalidateRuleCache(organizationId);
    
    return savedRule;
  }

  async evaluate(
    organizationId: string,
    evaluateDto: EvaluateRuleDto,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Get applicable rules from cache or database
      const rules = await this.getApplicableRules(
        organizationId,
        evaluateDto.eventType,
        undefined, // ruleType is not in the DTO
      );

      const results = [];

      for (const rule of rules) {
        try {
          const ruleStartTime = Date.now();
          
          // Check if rule conditions are met
          const conditionsMet = rule.evaluateConditions(evaluateDto.eventData);
          
          if (conditionsMet) {
            // Get applicable actions
            const actions = rule.getApplicableActions(evaluateDto.context);
            
            results.push({
              ruleId: rule.ruleId,
              ruleName: rule.name,
              matched: true,
              actions,
              priority: rule.priority,
            });
          }

          // Record metrics
          await this.recordEvaluation(
            rule.id,
            conditionsMet,
            Date.now() - ruleStartTime,
          );
        } catch (error) {
          this.logger.error(
            `Error evaluating rule ${rule.ruleId}: ${error.message}`,
            error.stack,
          );
          
          await this.recordEvaluation(rule.id, false, 0, true);
        }
      }

      // Sort results by priority
      results.sort((a, b) => b.priority - a.priority);

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Evaluated ${rules.length} rules in ${duration}ms, ${results.length} matched`,
      );

      return {
        evaluated: rules.length,
        matched: results.length,
        results,
        duration,
      };
    } catch (error) {
      this.logger.error(`Rule evaluation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getApplicableRules(
    organizationId: string,
    eventType?: string,
    ruleType?: NotificationRuleType,
  ): Promise<NotificationRule[]> {
    const cacheKey = `rules:${organizationId}:${eventType || 'all'}:${ruleType || 'all'}`;
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const queryBuilder = this.ruleRepository
      .createQueryBuilder('rule')
      .where('rule.organizationId = :organizationId', { organizationId })
      .andWhere('rule.isActive = true');

    if (ruleType) {
      queryBuilder.andWhere('rule.ruleType = :ruleType', { ruleType });
    }

    // If event type specified, also get rules from event mappings
    if (eventType) {
      const mappings = await this.mappingRepository.find({
        where: {
          organizationId,
          eventType,
          isActive: true,
        },
      });

      const ruleIds = mappings.map(m => m.ruleId).filter(Boolean);
      
      if (ruleIds.length > 0) {
        queryBuilder.orWhere('rule.id IN (:...ruleIds)', { ruleIds });
      }
    }

    const rules = await queryBuilder
      .orderBy('rule.priority', 'DESC')
      .getMany();

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, JSON.stringify(rules), { ttl: 600 });

    return rules;
  }

  async createEventMapping(
    organizationId: string,
    eventType: string,
    ruleId: string,
    templateId?: string,
  ): Promise<EventNotificationMapping> {
    const mapping = this.mappingRepository.create({
      organizationId,
      eventType,
      ruleId,
      templateId,
      isActive: true,
    });

    return await this.mappingRepository.save(mapping);
  }

  async getEventMappings(
    organizationId: string,
    eventType: string,
  ): Promise<EventNotificationMapping[]> {
    return await this.mappingRepository.find({
      where: {
        organizationId,
        eventType,
        isActive: true,
      },
      order: {
        priority: 'DESC',
      },
    });
  }

  async getRuleHistory(
    ruleId: string, 
    organizationId: string,
    limit?: number,
    offset?: number,
  ): Promise<NotificationRuleHistory[]> {
    const rule = await this.findOne(ruleId, organizationId);
    
    const queryBuilder = this.historyRepository
      .createQueryBuilder('history')
      .where('history.ruleId = :ruleId', { ruleId: rule.id })
      .orderBy('history.createdAt', 'DESC');
    
    if (limit) {
      queryBuilder.limit(limit);
    }
    
    if (offset) {
      queryBuilder.offset(offset);
    }
    
    return await queryBuilder.getMany();
  }

  private async createHistoryEntry(
    rule: NotificationRule,
    action: string,
    userId: string,
    changes?: any,
  ): Promise<void> {
    const history = this.historyRepository.create({
      rule,
      version: rule.version,
      changes: changes || {},
      changedBy: userId,
      changeReason: action,
    });

    await this.historyRepository.save(history);
  }

  private async recordEvaluation(
    ruleId: string,
    matched: boolean,
    executionTime: number,
    failed: boolean = false,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metrics = await this.metricsRepository.findOne({
      where: {
        ruleId,
        evaluationDate: today,
      },
    });

    if (!metrics) {
      metrics = this.metricsRepository.create({
        ruleId,
        evaluationDate: today,
        totalEvaluations: 0,
        matchedEvaluations: 0,
        failedEvaluations: 0,
        avgExecutionTimeMs: 0,
        notificationsTriggered: 0,
      });
    }

    metrics.totalEvaluations++;
    
    if (failed) {
      metrics.failedEvaluations++;
    } else if (matched) {
      metrics.matchedEvaluations++;
    }

    // Update average execution time
    metrics.avgExecutionTimeMs = 
      (metrics.avgExecutionTimeMs * (metrics.totalEvaluations - 1) + executionTime) / 
      metrics.totalEvaluations;

    await this.metricsRepository.save(metrics);
  }

  private async invalidateRuleCache(organizationId: string): Promise<void> {
    const pattern = `rules:${organizationId}:*`;
    await this.cacheService.deletePattern(pattern);
  }


  async testRule(
    organizationId: string,
    id: string,
    testData: any,
  ): Promise<any> {
    const rule = await this.findOne(organizationId, id);

    const conditionsMet = rule.evaluateConditions(testData);
    const actions = rule.getApplicableActions(testData.context);

    return {
      ruleId: rule.ruleId,
      ruleName: rule.name,
      conditionsMet,
      actions,
      conditions: rule.conditions,
      evaluationDetails: this.getEvaluationDetails(rule, testData),
    };
  }

  private getEvaluationDetails(rule: NotificationRule, data: any): any[] {
    return rule.conditions.map(condition => {
      const fieldValue = data[condition.field];
      const result = rule['evaluateCondition'](condition, data);
      
      return {
        condition: `${condition.field} ${condition.operator} ${condition.value}`,
        fieldValue,
        result,
      };
    });
  }
}