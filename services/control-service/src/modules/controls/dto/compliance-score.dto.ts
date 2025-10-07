import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsDateString, IsEnum, IsString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Framework } from '@soc-compliance/contracts';

export enum ComplianceRating {
  EXCELLENT = 'EXCELLENT',         // 90-100%
  GOOD = 'GOOD',                   // 80-89%
  SATISFACTORY = 'SATISFACTORY',   // 70-79%
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT', // 60-69%
  POOR = 'POOR',                   // Below 60%
}

export enum ScoreWeighting {
  CRITICAL = 'CRITICAL',  // 40% weight
  HIGH = 'HIGH',         // 30% weight
  MEDIUM = 'MEDIUM',     // 20% weight
  LOW = 'LOW',           // 10% weight
}

export class FrameworkScoreDto {
  @ApiProperty({ description: 'Compliance framework', enum: Framework })
  @IsEnum(Framework)
  framework: Framework;

  @ApiProperty({ description: 'Framework compliance score (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ description: 'Framework compliance rating', enum: ComplianceRating })
  @IsEnum(ComplianceRating)
  rating: ComplianceRating;

  @ApiProperty({ description: 'Number of controls in framework' })
  @IsNumber()
  totalControls: number;

  @ApiProperty({ description: 'Number of implemented controls' })
  @IsNumber()
  implementedControls: number;

  @ApiProperty({ description: 'Number of effective controls' })
  @IsNumber()
  effectiveControls: number;

  @ApiProperty({ description: 'Number of gaps identified' })
  @IsNumber()
  gapsIdentified: number;

  @ApiProperty({ description: 'Previous score for trend analysis', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  previousScore?: number;

  @ApiProperty({ description: 'Score trend percentage change', required: false })
  @IsNumber()
  @IsOptional()
  trendPercentage?: number;
}

export class CategoryScoreDto {
  @ApiProperty({ description: 'Control category name' })
  @IsString()
  category: string;

  @ApiProperty({ description: 'Category score (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ description: 'Score weighting', enum: ScoreWeighting })
  @IsEnum(ScoreWeighting)
  weighting: ScoreWeighting;

  @ApiProperty({ description: 'Weighted contribution to overall score' })
  @IsNumber()
  weightedScore: number;

  @ApiProperty({ description: 'Number of controls in category' })
  @IsNumber()
  controlCount: number;
}

export class ComplianceScoreDto {
  @ApiProperty({ description: 'Overall compliance score (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore: number;

  @ApiProperty({ description: 'Overall compliance rating', enum: ComplianceRating })
  @IsEnum(ComplianceRating)
  overallRating: ComplianceRating;

  @ApiProperty({ description: 'Score calculation date' })
  @IsDateString()
  calculatedAt: string;

  @ApiProperty({ description: 'Scoring period start date', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ description: 'Scoring period end date', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ description: 'Scores by framework', type: [FrameworkScoreDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameworkScoreDto)
  frameworkScores: FrameworkScoreDto[];

  @ApiProperty({ description: 'Scores by category', type: [CategoryScoreDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryScoreDto)
  categoryScores: CategoryScoreDto[];

  @ApiProperty({ description: 'Total number of controls evaluated' })
  @IsNumber()
  totalControls: number;

  @ApiProperty({ description: 'Number of controls fully implemented' })
  @IsNumber()
  fullyImplemented: number;

  @ApiProperty({ description: 'Number of controls partially implemented' })
  @IsNumber()
  partiallyImplemented: number;

  @ApiProperty({ description: 'Number of controls not implemented' })
  @IsNumber()
  notImplemented: number;

  @ApiProperty({ description: 'Number of controls marked as not applicable' })
  @IsNumber()
  notApplicable: number;

  @ApiProperty({ description: 'Previous overall score for trending', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  previousScore?: number;

  @ApiProperty({ description: 'Score improvement/decline percentage', required: false })
  @IsNumber()
  @IsOptional()
  scoreTrend?: number;

  @ApiProperty({ description: 'Target compliance score', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  targetScore?: number;

  @ApiProperty({ description: 'Gap to target score', required: false })
  @IsNumber()
  @IsOptional()
  gapToTarget?: number;

  @ApiProperty({ description: 'Key areas needing improvement', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  improvementAreas?: string[];

  @ApiProperty({ description: 'Key strengths', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @ApiProperty({ description: 'Scoring methodology notes', required: false })
  @IsString()
  @IsOptional()
  methodology?: string;
}
