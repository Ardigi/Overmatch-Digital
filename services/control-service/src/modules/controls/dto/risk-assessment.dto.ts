import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsNumber, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RiskLevel } from '@soc-compliance/contracts';

export enum RiskCategory {
  OPERATIONAL = 'OPERATIONAL',
  FINANCIAL = 'FINANCIAL',
  STRATEGIC = 'STRATEGIC',
  COMPLIANCE = 'COMPLIANCE',
  TECHNOLOGY = 'TECHNOLOGY',
  REPUTATIONAL = 'REPUTATIONAL',
  LEGAL = 'LEGAL',
}

export enum RiskAssessmentMethod {
  QUALITATIVE = 'QUALITATIVE',
  QUANTITATIVE = 'QUANTITATIVE',
  HYBRID = 'HYBRID',
}

export enum RiskTreatmentStrategy {
  ACCEPT = 'ACCEPT',
  AVOID = 'AVOID',
  MITIGATE = 'MITIGATE',
  TRANSFER = 'TRANSFER',
}

export class RiskFactorDto {
  @ApiProperty({ description: 'Risk factor name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Risk factor description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Risk factor impact score (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  impact: number;

  @ApiProperty({ description: 'Risk factor likelihood score (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  likelihood: number;

  @ApiProperty({ description: 'Control effectiveness against this factor (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  controlEffectiveness: number;
}

export class RiskMitigationDto {
  @ApiProperty({ description: 'Mitigation strategy description' })
  @IsString()
  strategy: string;

  @ApiProperty({ description: 'Mitigation effectiveness (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  effectiveness: number;

  @ApiProperty({ description: 'Implementation cost estimate', required: false })
  @IsNumber()
  @IsOptional()
  cost?: number;

  @ApiProperty({ description: 'Implementation timeline in days', required: false })
  @IsNumber()
  @IsOptional()
  timeline?: number;

  @ApiProperty({ description: 'Owner responsible for implementation', required: false })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class RiskAssessmentDto {
  @ApiProperty({ description: 'Risk assessment title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Risk assessment description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Risk category', enum: RiskCategory })
  @IsEnum(RiskCategory)
  category: RiskCategory;

  @ApiProperty({ description: 'Assessment method', enum: RiskAssessmentMethod })
  @IsEnum(RiskAssessmentMethod)
  assessmentMethod: RiskAssessmentMethod;

  @ApiProperty({ description: 'Inherent risk level (before controls)', enum: RiskLevel })
  @IsEnum(RiskLevel)
  inherentRisk: RiskLevel;

  @ApiProperty({ description: 'Residual risk level (after controls)', enum: RiskLevel })
  @IsEnum(RiskLevel)
  residualRisk: RiskLevel;

  @ApiProperty({ description: 'Risk likelihood score (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  likelihood: number;

  @ApiProperty({ description: 'Risk impact score (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  impact: number;

  @ApiProperty({ description: 'Overall risk score (likelihood × impact)', minimum: 1, maximum: 25 })
  @IsNumber()
  @Min(1)
  @Max(25)
  riskScore: number;

  @ApiProperty({ description: 'Risk tolerance threshold (1-25)', minimum: 1, maximum: 25, required: false })
  @IsNumber()
  @Min(1)
  @Max(25)
  @IsOptional()
  riskTolerance?: number;

  @ApiProperty({ description: 'Risk treatment strategy', enum: RiskTreatmentStrategy })
  @IsEnum(RiskTreatmentStrategy)
  treatmentStrategy: RiskTreatmentStrategy;

  @ApiProperty({ description: 'Assessment date' })
  @IsDateString()
  assessmentDate: string;

  @ApiProperty({ description: 'Assessment period start', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ description: 'Assessment period end', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ description: 'Assessor user ID' })
  @IsUUID()
  assessorId: string;

  @ApiProperty({ description: 'Risk owner user ID', required: false })
  @IsUUID()
  @IsOptional()
  riskOwnerId?: string;

  @ApiProperty({ description: 'Next review date', required: false })
  @IsDateString()
  @IsOptional()
  nextReviewDate?: string;

  @ApiProperty({ description: 'Specific risk factors', type: [RiskFactorDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RiskFactorDto)
  @IsOptional()
  riskFactors?: RiskFactorDto[];

  @ApiProperty({ description: 'Mitigation strategies', type: [RiskMitigationDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RiskMitigationDto)
  @IsOptional()
  mitigationStrategies?: RiskMitigationDto[];

  @ApiProperty({ description: 'Business processes affected', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  affectedProcesses?: string[];

  @ApiProperty({ description: 'Assets at risk', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assetsAtRisk?: string[];

  @ApiProperty({ description: 'Financial impact estimate', required: false })
  @IsNumber()
  @IsOptional()
  financialImpact?: number;

  @ApiProperty({ description: 'Operational impact description', required: false })
  @IsString()
  @IsOptional()
  operationalImpact?: string;

  @ApiProperty({ description: 'Regulatory/compliance implications', required: false })
  @IsString()
  @IsOptional()
  regulatoryImpact?: string;

  @ApiProperty({ description: 'Risk assessment notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
