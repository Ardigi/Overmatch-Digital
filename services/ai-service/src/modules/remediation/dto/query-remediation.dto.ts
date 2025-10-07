import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  RemediationPriority,
  RemediationStatus,
  RemediationType,
} from '../entities/remediation.entity';

export class QueryRemediationDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by finding ID' })
  @IsUUID()
  @IsOptional()
  findingId?: string;

  @ApiPropertyOptional({ enum: RemediationType, description: 'Filter by type' })
  @IsEnum(RemediationType)
  @IsOptional()
  type?: RemediationType;

  @ApiPropertyOptional({ enum: RemediationStatus, description: 'Filter by status' })
  @IsEnum(RemediationStatus)
  @IsOptional()
  status?: RemediationStatus;

  @ApiPropertyOptional({ enum: RemediationPriority, description: 'Filter by priority' })
  @IsEnum(RemediationPriority)
  @IsOptional()
  priority?: RemediationPriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user' })
  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filter by due date (before)' })
  @IsDateString()
  @IsOptional()
  dueBefore?: Date;

  @ApiPropertyOptional({ description: 'Search in title and description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Filter for overdue remediations' })
  @IsBoolean()
  @IsOptional()
  overdue?: boolean;
}
