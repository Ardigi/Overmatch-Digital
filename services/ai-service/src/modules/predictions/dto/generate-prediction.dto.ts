import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PredictionType } from '../entities/prediction.entity';

export class GeneratePredictionDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ enum: PredictionType, description: 'Type of prediction' })
  @IsEnum(PredictionType)
  type: PredictionType;

  @ApiProperty({ description: 'Prediction timeframe' })
  @IsString()
  timeframe: string;

  @ApiPropertyOptional({ description: 'Include confidence intervals' })
  @IsBoolean()
  @IsOptional()
  includeConfidenceIntervals?: boolean;

  @ApiPropertyOptional({ description: 'Include contributing factors' })
  @IsBoolean()
  @IsOptional()
  includeFactors?: boolean;

  @ApiPropertyOptional({ description: 'Features to include in model' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Minimum confidence threshold' })
  @IsNumber()
  @IsOptional()
  minConfidence?: number;

  @ApiPropertyOptional({ description: 'Use ensemble model' })
  @IsBoolean()
  @IsOptional()
  useEnsemble?: boolean;
}
