import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateMappingDto {
  @ApiProperty({ description: 'Source framework' })
  @IsString()
  sourceFramework: string;

  @ApiPropertyOptional({ description: 'Target framework' })
  @IsString()
  @IsOptional()
  targetFramework?: string;

  @ApiPropertyOptional({ description: 'Target frameworks for multi-framework mapping' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetFrameworks?: string[];

  @ApiPropertyOptional({ description: 'Use enhanced AI model' })
  @IsBoolean()
  @IsOptional()
  useEnhancedModel?: boolean;

  @ApiPropertyOptional({ description: 'Use latest ML model version' })
  @IsBoolean()
  @IsOptional()
  useLatestModel?: boolean;

  @ApiPropertyOptional({ description: 'Minimum similarity threshold (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityThreshold?: number;

  @ApiPropertyOptional({ description: 'Include partial mappings' })
  @IsBoolean()
  @IsOptional()
  includePartialMappings?: boolean;

  @ApiPropertyOptional({ description: 'Client ID for context' })
  @IsUUID()
  @IsOptional()
  clientId?: string;
}
