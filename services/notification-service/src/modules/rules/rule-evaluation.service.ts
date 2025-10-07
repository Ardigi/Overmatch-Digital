import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { NotificationRule } from './entities/notification-rule.entity';
import { 
  EvaluateRuleDto, 
  RuleEvaluationResultDto, 
  BatchEvaluateRulesDto,
  RuleConditionDto,
  RuleGroupDto,
  LogicalOperator,
  RuleOperator,
  NotificationActionDto
} from './dto';
import { CacheService } from '@soc-compliance/cache-common';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class RuleEvaluationService {
  private readonly logger = new Logger(RuleEvaluationService.name);
  private readonly CACHE_PREFIX = 'rule_eval';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(NotificationRule)
    private readonly ruleRepository: Repository<NotificationRule>,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  async evaluateRules(dto: EvaluateRuleDto): Promise<RuleEvaluationResultDto[]> {
    const startTime = Date.now();
    const results: RuleEvaluationResultDto[] = [];

    try {
      // Get applicable rules
      const rules = await this.getApplicableRules(dto);
      
      // Evaluate each rule
      for (const rule of rules) {
        const result = await this.evaluateRule(rule, dto);
        results.push(result);
        
        // Track metrics
        this.metricsService.incrementCounter('notification_rules_evaluated', {
          event_type: dto.eventType,
          matched: result.matched.toString(),
        });
      }

      // Record evaluation time
      const duration = Date.now() - startTime;
      this.metricsService.recordHistogram('rule_evaluation_duration', duration, {
        event_type: dto.eventType,
        rule_count: rules.length.toString(),
      });

      return results;
    } catch (error) {
      this.logger.error(`Error evaluating rules: ${error.message}`, error.stack);
      throw error;
    }
  }

  async evaluateBatch(dto: BatchEvaluateRulesDto): Promise<Map<string, RuleEvaluationResultDto[]>> {
    const results = new Map<string, RuleEvaluationResultDto[]>();

    if (dto.parallel) {
      // Process events in parallel
      const promises = dto.events.map(async (event, index) => {
        const evalDto: EvaluateRuleDto = {
          eventType: event.eventType,
          eventData: event.eventData,
          context: event.context,
          organizationId: dto.organizationId,
        };
        const eventResults = await this.evaluateRules(evalDto);
        return { index: index.toString(), results: eventResults };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ index, results: eventResults }) => {
        results.set(index, eventResults);
      });
    } else {
      // Process events sequentially
      for (let i = 0; i < dto.events.length; i++) {
        const event = dto.events[i];
        const evalDto: EvaluateRuleDto = {
          eventType: event.eventType,
          eventData: event.eventData,
          context: event.context,
          organizationId: dto.organizationId,
        };
        const eventResults = await this.evaluateRules(evalDto);
        results.set(i.toString(), eventResults);
      }
    }

    return results;
  }

  private async getApplicableRules(dto: EvaluateRuleDto): Promise<NotificationRule[]> {
    const cacheKey = `${this.CACHE_PREFIX}:rules:${dto.organizationId}:${dto.eventType}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build query conditions
    const where: any = {
      enabled: true,
      organizationId: dto.organizationId,
    };

    // Filter by event type or category
    if (dto.eventType) {
      where.eventType = dto.eventType;
    }

    // Filter by specific rule IDs if provided
    if (dto.ruleIds && dto.ruleIds.length > 0) {
      where.id = In(dto.ruleIds);
    }

    // Filter by tags if provided
    if (dto.tags && dto.tags.length > 0) {
      where.tags = In(dto.tags);
    }

    // Get rules from database
    let rules = await this.ruleRepository.find({
      where,
      order: {
        priority: 'ASC',
      },
    });

    // Filter by date range (active rules)
    const now = new Date();
    rules = rules.filter(rule => {
      if (rule.startDate && new Date(rule.startDate) > now) {
        return false;
      }
      if (rule.endDate && new Date(rule.endDate) < now) {
        return false;
      }
      return true;
    });

    // Check cooldown periods
    rules = await this.filterByCooldown(rules, dto);

    // Cache the results
    await this.cacheService.set(cacheKey, JSON.stringify(rules), { ttl: this.CACHE_TTL });

    return rules;
  }

  private async filterByCooldown(rules: NotificationRule[], dto: EvaluateRuleDto): Promise<NotificationRule[]> {
    const filtered: NotificationRule[] = [];

    for (const rule of rules) {
      if (!rule.cooldownMinutes || rule.cooldownMinutes === 0) {
        filtered.push(rule);
        continue;
      }

      // Check last trigger time from cache
      const cooldownKey = `${this.CACHE_PREFIX}:cooldown:${rule.id}:${dto.userId || dto.organizationId}`;
      const lastTrigger = await this.cacheService.get(cooldownKey);
      
      if (!lastTrigger) {
        filtered.push(rule);
      } else {
        const lastTriggerTime = new Date(lastTrigger).getTime();
        const cooldownExpiry = lastTriggerTime + (rule.cooldownMinutes * 60 * 1000);
        
        if (Date.now() > cooldownExpiry) {
          filtered.push(rule);
        }
      }
    }

    return filtered;
  }

  private async evaluateRule(rule: NotificationRule, dto: EvaluateRuleDto): Promise<RuleEvaluationResultDto> {
    const startTime = Date.now();
    const result: RuleEvaluationResultDto = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: false,
      actions: [],
      details: {
        conditionsEvaluated: 0,
        conditionsMatched: 0,
        evaluationTime: 0,
        failedConditions: [],
      },
    };

    try {
      // Parse conditions from JSON if stored as string
      const conditions = typeof rule.conditions === 'string' 
        ? JSON.parse(rule.conditions) 
        : rule.conditions;

      // Evaluate conditions
      const matched = await this.evaluateConditionGroup(
        conditions as RuleGroupDto,
        dto.eventData,
        dto.context || {},
        result.details,
      );

      result.matched = matched;

      // If matched, prepare actions
      if (matched) {
        const actions = typeof rule.actions === 'string'
          ? JSON.parse(rule.actions)
          : rule.actions;
        
        result.actions = this.prepareActions(actions as NotificationActionDto[], dto);

        // Update cooldown cache
        if (rule.cooldownMinutes && rule.cooldownMinutes > 0) {
          const cooldownKey = `${this.CACHE_PREFIX}:cooldown:${rule.id}:${dto.userId || dto.organizationId}`;
          await this.cacheService.set(
            cooldownKey,
            new Date().toISOString(),
            { ttl: rule.cooldownMinutes * 60 },
          );
        }

        // Track max triggers
        if (rule.maxTriggers && rule.maxTriggers > 0) {
          await this.trackTriggerCount(rule, dto);
        }
      }

      result.details.evaluationTime = Date.now() - startTime;
      return result;
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}: ${error.message}`, error.stack);
      result.error = error.message;
      return result;
    }
  }

  private async evaluateConditionGroup(
    group: RuleGroupDto,
    data: Record<string, any>,
    context: Record<string, any>,
    details: any,
  ): Promise<boolean> {
    const results: boolean[] = [];

    // Evaluate individual conditions
    if (group.conditions && group.conditions.length > 0) {
      for (const condition of group.conditions) {
        details.conditionsEvaluated++;
        const matched = await this.evaluateCondition(condition, data, context);
        
        if (matched) {
          details.conditionsMatched++;
        } else {
          details.failedConditions?.push({
            field: condition.field,
            operator: condition.operator,
            expected: condition.value || condition.values,
            actual: this.getFieldValue(condition.field, data, context),
          });
        }
        
        results.push(matched);
      }
    }

    // Evaluate nested groups
    if (group.groups && group.groups.length > 0) {
      for (const nestedGroup of group.groups) {
        const groupResult = await this.evaluateConditionGroup(nestedGroup, data, context, details);
        results.push(groupResult);
      }
    }

    // Apply logical operator
    if (group.operator === LogicalOperator.AND) {
      return results.every(r => r === true);
    } else if (group.operator === LogicalOperator.OR) {
      return results.some(r => r === true);
    }

    return false;
  }

  private async evaluateCondition(
    condition: RuleConditionDto,
    data: Record<string, any>,
    context: Record<string, any>,
  ): Promise<boolean> {
    const fieldValue = this.getFieldValue(condition.field, data, context);

    switch (condition.operator) {
      case RuleOperator.EQUALS:
        return fieldValue === condition.value;
        
      case RuleOperator.NOT_EQUALS:
        return fieldValue !== condition.value;
        
      case RuleOperator.CONTAINS:
        return String(fieldValue).includes(String(condition.value));
        
      case RuleOperator.NOT_CONTAINS:
        return !String(fieldValue).includes(String(condition.value));
        
      case RuleOperator.GREATER_THAN:
        return Number(fieldValue) > Number(condition.value);
        
      case RuleOperator.LESS_THAN:
        return Number(fieldValue) < Number(condition.value);
        
      case RuleOperator.GREATER_THAN_OR_EQUAL:
        return Number(fieldValue) >= Number(condition.value);
        
      case RuleOperator.LESS_THAN_OR_EQUAL:
        return Number(fieldValue) <= Number(condition.value);
        
      case RuleOperator.IN:
        return condition.values?.includes(fieldValue) || false;
        
      case RuleOperator.NOT_IN:
        return !condition.values?.includes(fieldValue) || false;
        
      case RuleOperator.REGEX:
        try {
          const regex = new RegExp(String(condition.value));
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
        
      case RuleOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
        
      case RuleOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null;
        
      default:
        return false;
    }
  }

  private getFieldValue(field: string, data: Record<string, any>, context: Record<string, any>): any {
    // Support nested field paths (e.g., "user.role.name")
    const parts = field.split('.');
    let value: any = data;

    for (const part of parts) {
      if (value === undefined || value === null) {
        // Try context if not found in data
        value = context;
        for (const contextPart of parts) {
          value = value?.[contextPart];
        }
        break;
      }
      value = value[part];
    }

    return value;
  }

  private prepareActions(actions: NotificationActionDto[], dto: EvaluateRuleDto): any[] {
    return actions.map(action => ({
      ...action,
      // Merge variables with event data
      variables: {
        ...dto.eventData,
        ...action.variables,
      },
      // Add context
      context: {
        userId: dto.userId,
        organizationId: dto.organizationId,
        eventType: dto.eventType,
        ...dto.context,
      },
    }));
  }

  private async trackTriggerCount(rule: NotificationRule, dto: EvaluateRuleDto): Promise<void> {
    const countKey = `${this.CACHE_PREFIX}:trigger_count:${rule.id}:${dto.eventType}`;
    const currentCount = await this.cacheService.get(countKey);
    const count = currentCount ? parseInt(currentCount, 10) + 1 : 1;
    
    if (count <= (rule.maxTriggers || Infinity)) {
      await this.cacheService.set(countKey, count.toString(), { ttl: 3600 }); // 1 hour TTL
    }
  }

  async getRuleStats(organizationId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const stats = {
      totalRules: 0,
      activeRules: 0,
      disabledRules: 0,
      rulesByEventType: {} as Record<string, number>,
      rulesByChannel: {} as Record<string, number>,
      evaluationMetrics: {
        totalEvaluations: 0,
        successfulMatches: 0,
        failedEvaluations: 0,
        averageEvaluationTime: 0,
      },
    };

    // Get all rules for organization
    const rules = await this.ruleRepository.find({
      where: { organizationId },
    });

    stats.totalRules = rules.length;
    stats.activeRules = rules.filter(r => r.enabled).length;
    stats.disabledRules = rules.filter(r => !r.enabled).length;

    // Group by event type
    rules.forEach(rule => {
      if (!stats.rulesByEventType[rule.eventType]) {
        stats.rulesByEventType[rule.eventType] = 0;
      }
      stats.rulesByEventType[rule.eventType]++;
    });

    // Get evaluation metrics from monitoring service
    const metrics = this.metricsService.getMetrics();
    
    // Extract relevant notification metrics
    metrics.forEach((value, key) => {
      if (key.startsWith('notification_rules_evaluated')) {
        stats.evaluationMetrics.totalEvaluations = value || 0;
      }
      if (key.startsWith('notification_rules_matched')) {
        stats.evaluationMetrics.successfulMatches = value || 0;
      }
      if (key.startsWith('notification_rules_failed')) {
        stats.evaluationMetrics.failedEvaluations = value || 0;
      }
    });
    
    // Calculate success rate if we have evaluations
    if (stats.evaluationMetrics.totalEvaluations > 0) {
      stats.evaluationMetrics.averageEvaluationTime = 
        ((stats.evaluationMetrics.totalEvaluations - stats.evaluationMetrics.failedEvaluations) / 
          stats.evaluationMetrics.totalEvaluations) * 100;
    }

    return stats;
  }
}