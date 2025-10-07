import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, IsArray, IsDateString, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Effectiveness } from '@soc-compliance/contracts';

export enum EffectivenessAssessmentMethod {
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  AUTOMATED_TESTING = 'AUTOMATED_TESTING',
  WALKTHROUGH = 'WALKTHROUGH',
  INQUIRY = 'INQUIRY',
  OBSERVATION = 'OBSERVATION',
  INSPECTION = 'INSPECTION',
  REPERFORMANCE = 'REPERFORMANCE',
}

export class EffectivenessMetricDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value: number;

  @ApiProperty({ description: 'Target value', required: false })
  @IsNumber()
  @IsOptional()
  target?: number;

  @ApiProperty({ description: 'Metric unit (%, count, etc.)', required: false })
  @IsString()
  @IsOptional()
  unit?: string;
}

export class EffectivenessDto {
  @ApiProperty({ description: 'Overall effectiveness rating', enum: Effectiveness })
  @IsEnum(Effectiveness)
  effectiveness: Effectiveness;

  @ApiProperty({ description: 'Effectiveness score (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ description: 'Assessment method', enum: EffectivenessAssessmentMethod })
  @IsEnum(EffectivenessAssessmentMethod)
  assessmentMethod: EffectivenessAssessmentMethod;

  @ApiProperty({ description: 'Assessment date' })
  @IsDateString()
  assessmentDate: string;

  @ApiProperty({ description: 'Assessment period start date', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ description: 'Assessment period end date', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ description: 'Sample size used in assessment', required: false })
  @IsNumber()
  @IsOptional()
  sampleSize?: number;

  @ApiProperty({ description: 'Population size', required: false })
  @IsNumber()
  @IsOptional()
  populationSize?: number;

  @ApiProperty({ description: 'Control strengths', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @ApiProperty({ description: 'Control weaknesses', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weaknesses?: string[];

  @ApiProperty({ description: 'Improvement recommendations', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  improvements?: string[];

  @ApiProperty({ description: 'Key effectiveness metrics', type: [EffectivenessMetricDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EffectivenessMetricDto)
  @IsOptional()
  metrics?: EffectivenessMetricDto[];

  @ApiProperty({ description: 'Assessment notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Assessor comments', required: false })
  @IsString()
  @IsOptional()
  assessorComments?: string;

  @ApiProperty({ description: 'Management response', required: false })
  @IsString()
  @IsOptional()
  managementResponse?: string;

  @ApiProperty({ description: 'Next assessment due date', required: false })
  @IsDateString()
  @IsOptional()
  nextAssessmentDue?: string;
}
