import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { PredictionStatus, PredictionType } from '../entities/prediction.entity';

export class QueryPredictionDto {
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

  @ApiPropertyOptional({ enum: PredictionType, description: 'Filter by prediction type' })
  @IsEnum(PredictionType)
  @IsOptional()
  type?: PredictionType;

  @ApiPropertyOptional({ enum: PredictionStatus, description: 'Filter by status' })
  @IsEnum(PredictionStatus)
  @IsOptional()
  status?: PredictionStatus;

  @ApiPropertyOptional({ description: 'Filter by timeframe' })
  @IsString()
  @IsOptional()
  timeframe?: string;

  @ApiPropertyOptional({ description: 'Filter by start date' })
  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by end date' })
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
