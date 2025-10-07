import { IsString, IsObject, IsArray, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvaluateRuleDto {
  @ApiProperty({ description: 'Event type to evaluate' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ description: 'Event data/payload to evaluate against rules' })
  @IsObject()
  eventData: Record<string, any>;

  @ApiPropertyOptional({ description: 'User ID for context' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Organization ID for context' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Additional context data' })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Specific rule IDs to evaluate (if not provided, evaluates all applicable rules)' })
  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  ruleIds?: string[];

  @ApiPropertyOptional({ description: 'Tags to filter rules by' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class RuleEvaluationResultDto {
  @ApiProperty({ description: 'Rule ID that was evaluated' })
  ruleId: string;

  @ApiProperty({ description: 'Rule name' })
  ruleName: string;

  @ApiProperty({ description: 'Whether the rule matched' })
  matched: boolean;

  @ApiProperty({ description: 'Actions that should be triggered' })
  actions: any[];

  @ApiPropertyOptional({ description: 'Evaluation details' })
  details?: {
    conditionsEvaluated: number;
    conditionsMatched: number;
    evaluationTime: number;
    failedConditions?: Array<{
      field: string;
      operator: string;
      expected: any;
      actual: any;
    }>;
  };

  @ApiPropertyOptional({ description: 'Error if evaluation failed' })
  error?: string;
}

export class BatchEvaluateRulesDto {
  @ApiProperty({ description: 'Array of events to evaluate' })
  @IsArray()
  events: Array<{
    eventType: string;
    eventData: Record<string, any>;
    context?: Record<string, any>;
  }>;

  @ApiPropertyOptional({ description: 'Organization ID for all events' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Whether to process events in parallel' })
  @IsOptional()
  parallel?: boolean;
}