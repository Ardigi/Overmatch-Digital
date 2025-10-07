import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { WorkflowStatus } from '../entities/workflow.entity';
import { InstanceStatus } from '../entities/workflow-instance.entity';

export class WorkflowQueryDto {
  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Workflow category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Workflow status',
    enum: WorkflowStatus,
  })
  @IsEnum(WorkflowStatus)
  @IsOptional()
  status?: WorkflowStatus;

  @ApiPropertyOptional({ description: 'Search term for name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Workflow name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 10 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}

export class WorkflowInstanceQueryDto {
  @ApiPropertyOptional({
    description: 'Instance status',
    enum: InstanceStatus,
  })
  @IsEnum(InstanceStatus)
  @IsOptional()
  status?: InstanceStatus;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'User who initiated' })
  @IsString()
  @IsOptional()
  initiatedBy?: string;

  @ApiPropertyOptional({ description: 'Correlation ID' })
  @IsString()
  @IsOptional()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 10 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}

export class WorkflowTemplateQueryDto {
  @ApiPropertyOptional({ description: 'Template category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Only public templates' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Search term for name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 10 })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}
