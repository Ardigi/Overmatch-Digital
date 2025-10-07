import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ComplianceAnalysisDto {
  @ApiProperty({ description: 'Client ID to analyze' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Compliance frameworks to analyze' })
  @IsArray()
  @IsString({ each: true })
  frameworks: string[];

  @ApiPropertyOptional({ description: 'Include historical data' })
  @IsBoolean()
  @IsOptional()
  includeHistorical?: boolean;

  @ApiPropertyOptional({ description: 'Time period for analysis' })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ description: 'Enable fallback to rule-based analysis' })
  @IsBoolean()
  @IsOptional()
  fallbackEnabled?: boolean;
}
