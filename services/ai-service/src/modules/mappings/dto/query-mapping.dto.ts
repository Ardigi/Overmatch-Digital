import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { MappingStatus } from '../entities/framework-mapping.entity';

export class QueryMappingDto {
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

  @ApiPropertyOptional({ description: 'Filter by source framework' })
  @IsString()
  @IsOptional()
  sourceFramework?: string;

  @ApiPropertyOptional({ description: 'Filter by target framework' })
  @IsString()
  @IsOptional()
  targetFramework?: string;

  @ApiPropertyOptional({ enum: MappingStatus, description: 'Filter by status' })
  @IsEnum(MappingStatus)
  @IsOptional()
  status?: MappingStatus;

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
