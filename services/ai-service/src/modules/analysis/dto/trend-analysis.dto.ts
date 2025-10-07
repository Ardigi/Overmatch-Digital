import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class TrendAnalysisDto {
  @ApiProperty({ description: 'Client ID to analyze' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Analysis period' })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ description: 'Metrics to analyze' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  metrics?: string[];

  @ApiPropertyOptional({ description: 'Detect anomalies in trends' })
  @IsBoolean()
  @IsOptional()
  detectAnomalies?: boolean;

  @ApiPropertyOptional({ description: 'Include forecasting' })
  @IsBoolean()
  @IsOptional()
  includeForecast?: boolean;
}
