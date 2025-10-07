import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { PredictionType } from '../entities/prediction.entity';

export class CreatePredictionDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: PredictionType, description: 'Type of prediction' })
  @IsEnum(PredictionType)
  type: PredictionType;

  @ApiProperty({ description: 'Prediction timeframe (e.g., "30days", "90days", "1year")' })
  @IsString()
  timeframe: string;

  @ApiPropertyOptional({ description: 'Description of the prediction' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'User who created the prediction' })
  @IsUUID()
  @IsOptional()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Model version to use' })
  @IsString()
  @IsOptional()
  modelVersion?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
