import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AnalyzeImpactDto {
  @ApiProperty({ description: 'Remediation ID to analyze impact for' })
  @IsUUID()
  remediationId: string;

  @ApiPropertyOptional({
    description: 'Impact dimensions to analyze',
    example: ['compliance', 'security', 'operations', 'financial'],
  })
  @IsArray()
  @IsOptional()
  impactDimensions?: string[];

  @ApiPropertyOptional({ description: 'Include cost-benefit analysis' })
  @IsOptional()
  includeCostBenefit?: boolean;

  @ApiPropertyOptional({ description: 'Include risk reduction metrics' })
  @IsOptional()
  includeRiskMetrics?: boolean;
}
