import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Import from entity to ensure consistency
import { FrameworkType } from '../entities/framework.entity';
import type { FrameworkCrossMappings } from '../../shared/types';

export class CreateFrameworkDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  identifier: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  version: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FrameworkType })
  @IsEnum(FrameworkType)
  type: FrameworkType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  regulatoryBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  effectiveDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastUpdated?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officialReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: {
    officialUrl?: string;
    certificationAvailable?: boolean;
    updateFrequency?: string;
    industryScope?: string[];
    geographicScope?: string[];
    crossMappings?: FrameworkCrossMappings;
    complianceRequirements?: any[];
    auditGuidance?: any;
  };

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
