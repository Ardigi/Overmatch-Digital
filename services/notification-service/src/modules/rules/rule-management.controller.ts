import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../auth/organization.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationRulesService } from './notification-rules.service';
import { RuleEvaluationService } from './rule-evaluation.service';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  EvaluateRuleDto,
  RuleEvaluationResultDto,
  BatchEvaluateRulesDto,
  RuleFilterDto,
  RuleStatsDto,
} from './dto';
import { NotificationRule } from './entities/notification-rule.entity';

@ApiTags('notification-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('api/v1/notification-rules')
export class RuleManagementController {
  private readonly logger = new Logger(RuleManagementController.name);

  constructor(
    private readonly rulesService: NotificationRulesService,
    private readonly evaluationService: RuleEvaluationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification rule' })
  @ApiResponse({ status: 201, description: 'Rule created successfully', type: NotificationRule })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createRule(
    @Body() createDto: CreateNotificationRuleDto,
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    this.logger.log(`Creating notification rule: ${createDto.name} for org: ${user.organizationId}`);
    
    const rule = await this.rulesService.create({
      ...createDto,
      organizationId: user.organizationId,
      createdBy: user.id,
    });

    this.logger.log(`Rule created successfully: ${rule.id}`);
    return rule;
  }

  @Get()
  @ApiOperation({ summary: 'Get all notification rules with filtering' })
  @ApiResponse({ status: 200, description: 'Rules retrieved successfully', type: [NotificationRule] })
  @ApiQuery({ type: RuleFilterDto })
  async getRules(
    @Query() filterDto: RuleFilterDto,
    @CurrentUser() user: any,
  ): Promise<{
    data: NotificationRule[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Force organization filter for security
    filterDto.organizationId = user.organizationId;
    
    const result = await this.rulesService.findAll(filterDto);
    return result;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get rule statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ type: RuleStatsDto })
  async getRuleStats(
    @Query() statsDto: RuleStatsDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    const stats = await this.evaluationService.getRuleStats(
      user.organizationId,
      statsDto.startDate,
      statsDto.endDate,
    );
    return stats;
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate rules for an event' })
  @ApiResponse({ status: 200, description: 'Evaluation completed', type: [RuleEvaluationResultDto] })
  @ApiResponse({ status: 400, description: 'Invalid evaluation request' })
  async evaluateRules(
    @Body() evaluateDto: EvaluateRuleDto,
    @CurrentUser() user: any,
  ): Promise<RuleEvaluationResultDto[]> {
    // Set organization context
    evaluateDto.organizationId = user.organizationId;
    evaluateDto.userId = evaluateDto.userId || user.id;
    
    const results = await this.evaluationService.evaluateRules(evaluateDto);
    
    this.logger.log(`Evaluated ${results.length} rules for event: ${evaluateDto.eventType}`);
    return results;
  }

  @Post('evaluate/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate rules for multiple events' })
  @ApiResponse({ status: 200, description: 'Batch evaluation completed' })
  @ApiResponse({ status: 400, description: 'Invalid batch request' })
  async evaluateBatch(
    @Body() batchDto: BatchEvaluateRulesDto,
    @CurrentUser() user: any,
  ): Promise<Map<string, RuleEvaluationResultDto[]>> {
    // Set organization context
    batchDto.organizationId = user.organizationId;
    
    const results = await this.evaluationService.evaluateBatch(batchDto);
    
    this.logger.log(`Batch evaluated ${batchDto.events.length} events`);
    return results;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule retrieved successfully', type: NotificationRule })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    const rule = await this.rulesService.findOne(id, user.organizationId);
    return rule;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully', type: NotificationRule })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateNotificationRuleDto,
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    this.logger.log(`Updating rule: ${id}`);
    
    const rule = await this.rulesService.update(id, {
      ...updateDto,
      organizationId: user.organizationId,
      updatedBy: user.id,
    });

    this.logger.log(`Rule updated successfully: ${id}`);
    return rule;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 204, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    this.logger.log(`Deleting rule: ${id}`);
    
    await this.rulesService.remove(id, user.organizationId);
    
    this.logger.log(`Rule deleted successfully: ${id}`);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule enabled successfully', type: NotificationRule })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async enableRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    const rule = await this.rulesService.setEnabled(id, true, user.organizationId);
    this.logger.log(`Rule enabled: ${id}`);
    return rule;
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule disabled successfully', type: NotificationRule })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async disableRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    const rule = await this.rulesService.setEnabled(id, false, user.organizationId);
    this.logger.log(`Rule disabled: ${id}`);
    return rule;
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone an existing notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID to clone' })
  @ApiResponse({ status: 201, description: 'Rule cloned successfully', type: NotificationRule })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async cloneRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneOptions: { name?: string; enabled?: boolean },
    @CurrentUser() user: any,
  ): Promise<NotificationRule> {
    this.logger.log(`Cloning rule: ${id}`);
    
    const clonedRule = await this.rulesService.clone(
      id,
      user.organizationId,
      {
        name: cloneOptions.name,
        enabled: cloneOptions.enabled ?? false,
        createdBy: user.id,
      },
    );

    this.logger.log(`Rule cloned successfully: ${clonedRule.id}`);
    return clonedRule;
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get rule evaluation history' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of records to skip' })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  async getRuleHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @CurrentUser() user?: any,
  ): Promise<any[]> {
    const organizationId = user?.organizationId || 'default-org';
    return await this.rulesService.getRuleHistory(
      id,
      organizationId,
      limit || 100,
      offset || 0,
    );
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a rule configuration without saving' })
  @ApiResponse({ status: 200, description: 'Test completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid rule configuration' })
  async testRule(
    @Body() testDto: {
      rule: CreateNotificationRuleDto;
      testData: Record<string, any>;
    },
    @CurrentUser() user: any,
  ): Promise<{
    valid: boolean;
    matched: boolean;
    errors?: string[];
    actions?: any[];
  }> {
    try {
      // Create temporary rule object (not saved)
      const tempRule = new NotificationRule();
      Object.assign(tempRule, {
        ...testDto.rule,
        id: 'test-rule',
        organizationId: user.organizationId,
      });

      // Evaluate against test data
      const evalDto: EvaluateRuleDto = {
        eventType: testDto.rule.eventType,
        eventData: testDto.testData,
        organizationId: user.organizationId,
        userId: user.id,
        ruleIds: ['test-rule'],
      };

      // Mock evaluation (since we can't save the test rule)
      // In production, this would use a special test mode
      const result: any = {
        valid: true,
        matched: false,
        actions: [],
      };

      // Validate rule structure
      if (!testDto.rule.conditions || !testDto.rule.actions) {
        result.valid = false;
        result.errors = ['Rule must have conditions and actions'];
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        matched: false,
        errors: [error.message],
      };
    }
  }
}