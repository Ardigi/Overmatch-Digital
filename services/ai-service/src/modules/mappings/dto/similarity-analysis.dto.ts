import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ControlDto {
  @ApiProperty({ description: 'Framework name' })
  @IsString()
  framework: string;

  @ApiProperty({ description: 'Control ID' })
  @IsString()
  controlId: string;

  @ApiPropertyOptional({ description: 'Control description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class SimilarityAnalysisDto {
  @ApiPropertyOptional({ description: 'First control for comparison' })
  @IsObject()
  @ValidateNested()
  @Type(() => ControlDto)
  @IsOptional()
  control1?: ControlDto;

  @ApiPropertyOptional({ description: 'Second control for comparison' })
  @IsObject()
  @ValidateNested()
  @Type(() => ControlDto)
  @IsOptional()
  control2?: ControlDto;

  @ApiPropertyOptional({ description: 'Source controls for batch analysis' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sourceControls?: string[];

  @ApiPropertyOptional({ description: 'Target framework for batch analysis' })
  @IsString()
  @IsOptional()
  targetFramework?: string;

  @ApiPropertyOptional({ description: 'Source text for NLP analysis' })
  @IsString()
  @IsOptional()
  sourceText?: string;

  @ApiPropertyOptional({ description: 'Find best matches' })
  @IsBoolean()
  @IsOptional()
  findBestMatches?: boolean;

  @ApiPropertyOptional({ description: 'Number of top matches to return' })
  @IsNumber()
  @IsOptional()
  topN?: number;

  @ApiPropertyOptional({ description: 'Use NLP for analysis' })
  @IsBoolean()
  @IsOptional()
  useNLP?: boolean;
}
