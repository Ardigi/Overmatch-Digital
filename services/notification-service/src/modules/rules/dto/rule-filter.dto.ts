import { IsString, IsBoolean, IsArray, IsOptional, IsEnum, IsNumber, Min, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum RuleSortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PRIORITY = 'priority',
  EVENT_TYPE = 'eventType',
}

export class RuleFilterDto {
  @ApiPropertyOptional({ description: 'Filter by rule name (partial match)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Filter by event category' })
  @IsString()
  @IsOptional()
  eventCategory?: string;

  @ApiPropertyOptional({ description: 'Filter by enabled status' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by organization ID' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Include only active rules (within start/end dates)' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: RuleSortBy, description: 'Sort by field' })
  @IsEnum(RuleSortBy)
  @IsOptional()
  sortBy?: RuleSortBy = RuleSortBy.PRIORITY;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

export class RuleStatsDto {
  @ApiPropertyOptional({ description: 'Organization ID for stats' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Date range start' })
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Date range end' })
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Group stats by period (day, week, month)' })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}