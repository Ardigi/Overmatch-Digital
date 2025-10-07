import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum RecommendationPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export class RecommendationDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Areas to focus recommendations on' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  areas?: string[];

  @ApiPropertyOptional({ enum: RecommendationPriority, description: 'Priority filter' })
  @IsEnum(RecommendationPriority)
  @IsOptional()
  priority?: RecommendationPriority;

  @ApiPropertyOptional({ description: 'Include client context in recommendations' })
  @IsBoolean()
  @IsOptional()
  includeContext?: boolean;

  @ApiPropertyOptional({ description: 'Include industry-specific recommendations' })
  @IsBoolean()
  @IsOptional()
  industrySpecific?: boolean;
}
