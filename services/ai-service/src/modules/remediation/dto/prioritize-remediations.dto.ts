import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class PrioritizeRemediationsDto {
  @ApiProperty({ description: 'Remediation IDs to prioritize' })
  @IsArray()
  @IsUUID('4', { each: true })
  remediationIds: string[];

  @ApiProperty({
    description: 'Prioritization method',
    enum: ['risk_based', 'quick_wins', 'cost_benefit', 'compliance_impact'],
  })
  @IsEnum(['risk_based', 'quick_wins', 'cost_benefit', 'compliance_impact'])
  prioritizationMethod: string;

  @ApiPropertyOptional({ description: 'Additional prioritization criteria' })
  @IsOptional()
  criteria?: Record<string, any>;
}
