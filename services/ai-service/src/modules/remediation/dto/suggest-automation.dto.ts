import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class SuggestAutomationDto {
  @ApiProperty({ description: 'Remediation IDs to analyze for automation' })
  @IsArray()
  @IsUUID('4', { each: true })
  remediationIds: string[];

  @ApiPropertyOptional({
    description: 'Automation goal',
    enum: ['maximize_efficiency', 'minimize_cost', 'reduce_errors', 'accelerate_delivery'],
  })
  @IsEnum(['maximize_efficiency', 'minimize_cost', 'reduce_errors', 'accelerate_delivery'])
  @IsOptional()
  automationGoal?: string;

  @ApiPropertyOptional({ description: 'Include ROI analysis' })
  @IsOptional()
  includeROIAnalysis?: boolean;

  @ApiPropertyOptional({ description: 'Technology preferences' })
  @IsArray()
  @IsOptional()
  technologyPreferences?: string[];
}
