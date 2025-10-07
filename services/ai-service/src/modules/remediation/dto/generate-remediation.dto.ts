import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateRemediationDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Finding ID to generate remediation for' })
  @IsUUID()
  @IsOptional()
  findingId?: string;

  @ApiPropertyOptional({ description: 'Finding details if no ID provided' })
  @IsObject()
  @IsOptional()
  finding?: {
    type: string;
    severity: string;
    description: string;
    controlId?: string;
    framework?: string;
  };

  @ApiPropertyOptional({ description: 'Include cost estimation' })
  @IsBoolean()
  @IsOptional()
  includeCostEstimate?: boolean;

  @ApiPropertyOptional({ description: 'Include implementation steps' })
  @IsBoolean()
  @IsOptional()
  includeSteps?: boolean;

  @ApiPropertyOptional({ description: 'Prioritize automated solutions' })
  @IsBoolean()
  @IsOptional()
  preferAutomation?: boolean;

  @ApiPropertyOptional({ description: 'Resource constraints' })
  @IsObject()
  @IsOptional()
  constraints?: {
    maxBudget?: number;
    maxTimeframe?: number;
    availableResources?: string[];
  };
}
