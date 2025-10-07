import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class EstimateEffortDto {
  @ApiProperty({ description: 'Remediation ID to estimate effort for' })
  @IsUUID()
  remediationId: string;

  @ApiPropertyOptional({ description: 'Include detailed breakdown' })
  @IsBoolean()
  @IsOptional()
  includeBreakdown?: boolean;

  @ApiPropertyOptional({ description: 'Consider dependencies in estimation' })
  @IsBoolean()
  @IsOptional()
  considerDependencies?: boolean;

  @ApiPropertyOptional({ description: 'Include confidence intervals' })
  @IsBoolean()
  @IsOptional()
  includeConfidenceIntervals?: boolean;
}
