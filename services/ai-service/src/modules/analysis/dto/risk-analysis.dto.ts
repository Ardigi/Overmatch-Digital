import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class RiskAnalysisDto {
  @ApiProperty({ description: 'Client ID to analyze' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Risk categories to analyze' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  riskCategories?: string[];

  @ApiPropertyOptional({ description: 'Include predictive analysis' })
  @IsBoolean()
  @IsOptional()
  includePredictions?: boolean;

  @ApiPropertyOptional({ description: 'Include historical risk data' })
  @IsBoolean()
  @IsOptional()
  includeHistorical?: boolean;

  @ApiPropertyOptional({ description: 'Time frame for historical data' })
  @IsString()
  @IsOptional()
  timeframe?: string;
}
