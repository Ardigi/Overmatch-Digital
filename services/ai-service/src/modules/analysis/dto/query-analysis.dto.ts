import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnalysisStatus, AnalysisType } from '../entities/compliance-analysis.entity';

export class QueryAnalysisDto {
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

  @ApiPropertyOptional({ enum: AnalysisType, description: 'Filter by analysis type' })
  @IsEnum(AnalysisType)
  @IsOptional()
  type?: AnalysisType;

  @ApiPropertyOptional({ enum: AnalysisStatus, description: 'Filter by status' })
  @IsEnum(AnalysisStatus)
  @IsOptional()
  status?: AnalysisStatus;

  @ApiPropertyOptional({ description: 'Filter by start date' })
  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by end date' })
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Search in description' })
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
}
