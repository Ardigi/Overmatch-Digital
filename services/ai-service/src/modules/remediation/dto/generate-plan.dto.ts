import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GenerateRemediationPlanDto {
  @ApiProperty({ description: 'Finding IDs to generate remediation plan for' })
  @IsArray()
  @IsUUID('4', { each: true })
  findingIds: string[];

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({
    description: 'Optimization strategy',
    enum: ['minimize_effort', 'minimize_cost', 'minimize_time', 'maximize_impact'],
  })
  @IsEnum(['minimize_effort', 'minimize_cost', 'minimize_time', 'maximize_impact'])
  @IsOptional()
  optimizationStrategy?: string;

  @ApiPropertyOptional({ description: 'Include automation opportunities' })
  @IsBoolean()
  @IsOptional()
  includeAutomation?: boolean;

  @ApiPropertyOptional({ description: 'Budget constraint in dollars' })
  @IsNumber()
  @IsOptional()
  budgetConstraint?: number;

  @ApiPropertyOptional({ description: 'Use AI guidance for recommendations' })
  @IsBoolean()
  @IsOptional()
  useAIGuidance?: boolean;
}
