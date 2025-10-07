import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AnalysisType } from '../entities/compliance-analysis.entity';

export class CreateAnalysisDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: AnalysisType, description: 'Type of analysis' })
  @IsEnum(AnalysisType)
  type: AnalysisType;

  @ApiPropertyOptional({ description: 'Compliance frameworks to analyze' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  frameworks?: string[];

  @ApiPropertyOptional({ description: 'Description of the analysis' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'User who created the analysis' })
  @IsUUID()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'AI model version to use' })
  @IsString()
  @IsOptional()
  modelVersion?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
