import { IsString, IsEnum, IsObject, IsArray, IsBoolean, IsOptional, IsNotEmpty, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export enum RuleOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  REGEX = 'regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}

export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
}

export class RuleConditionDto {
  @ApiProperty({ description: 'Field path to evaluate (e.g., "user.role", "control.status")' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: RuleOperator, description: 'Comparison operator' })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiPropertyOptional({ description: 'Value to compare against' })
  @IsOptional()
  value?: any;

  @ApiPropertyOptional({ description: 'Array of values for IN/NOT_IN operators' })
  @IsArray()
  @IsOptional()
  values?: any[];
}

export class RuleGroupDto {
  @ApiProperty({ enum: LogicalOperator, description: 'Logical operator for combining conditions' })
  @IsEnum(LogicalOperator)
  operator: LogicalOperator;

  @ApiProperty({ type: [RuleConditionDto], description: 'Array of conditions' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiPropertyOptional({ type: [RuleGroupDto], description: 'Nested condition groups' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuleGroupDto)
  groups?: RuleGroupDto[];
}

export class NotificationActionDto {
  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Template code to use for this notification' })
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @ApiPropertyOptional({ description: 'Priority level (low, medium, high, urgent)' })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ description: 'Delay in minutes before sending notification' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10080) // Max 1 week
  delayMinutes?: number;

  @ApiPropertyOptional({ description: 'Additional variables to pass to the template' })
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Specific recipients to override default' })
  @IsArray()
  @IsOptional()
  recipients?: string[];

  @ApiPropertyOptional({ description: 'Recipient roles to target' })
  @IsArray()
  @IsOptional()
  recipientRoles?: string[];
}

export class CreateNotificationRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Rule description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Event type this rule applies to (e.g., "user.created", "control.failed")' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiPropertyOptional({ description: 'Event category for broader matching (e.g., "user", "control")' })
  @IsString()
  @IsOptional()
  eventCategory?: string;

  @ApiProperty({ type: RuleGroupDto, description: 'Rule conditions' })
  @ValidateNested()
  @Type(() => RuleGroupDto)
  conditions: RuleGroupDto;

  @ApiProperty({ type: [NotificationActionDto], description: 'Actions to take when rule matches' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationActionDto)
  actions: NotificationActionDto[];

  @ApiProperty({ description: 'Whether the rule is enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Rule priority (lower number = higher priority)' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ description: 'Rule metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags for categorizing rules' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Start date for rule activation' })
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for rule deactivation' })
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Maximum number of times this rule can trigger per event' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  maxTriggers?: number;

  @ApiPropertyOptional({ description: 'Cooldown period in minutes between triggers' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1440) // Max 24 hours
  cooldownMinutes?: number;
}