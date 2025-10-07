import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsNumber, Min, Max } from 'class-validator';

export enum GapSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum GapStatus {
  IDENTIFIED = 'IDENTIFIED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  ACCEPTED = 'ACCEPTED', // Risk accepted, no remediation planned
  CLOSED = 'CLOSED',
}

export enum GapCategory {
  DESIGN = 'DESIGN',
  IMPLEMENTATION = 'IMPLEMENTATION',
  OPERATIONAL = 'OPERATIONAL',
  DOCUMENTATION = 'DOCUMENTATION',
  TRAINING = 'TRAINING',
  TECHNICAL = 'TECHNICAL',
}

export class GapDto {
  @ApiProperty({ description: 'Gap title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed gap description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Gap category', enum: GapCategory })
  @IsEnum(GapCategory)
  category: GapCategory;

  @ApiProperty({ description: 'Gap severity', enum: GapSeverity })
  @IsEnum(GapSeverity)
  severity: GapSeverity;

  @ApiProperty({ description: 'Root cause analysis' })
  @IsString()
  rootCause: string;

  @ApiProperty({ description: 'Business impact description' })
  @IsString()
  impact: string;

  @ApiProperty({ description: 'Risk score (1-10)', minimum: 1, maximum: 10, required: false })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  riskScore?: number;

  @ApiProperty({ description: 'Remediation plan' })
  @IsString()
  remediationPlan: string;

  @ApiProperty({ description: 'Target remediation date' })
  @IsDateString()
  targetDate: string;

  @ApiProperty({ description: 'Estimated effort in hours', required: false })
  @IsNumber()
  @IsOptional()
  estimatedEffort?: number;

  @ApiProperty({ description: 'Estimated cost', required: false })
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @ApiProperty({ description: 'Owner/assignee user ID' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ description: 'Gap status', enum: GapStatus, required: false })
  @IsEnum(GapStatus)
  @IsOptional()
  status?: GapStatus;

  @ApiProperty({ description: 'Current progress percentage (0-100)', minimum: 0, maximum: 100, required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Related evidence IDs', type: [String], required: false })
  @IsOptional()
  evidenceIds?: string[];

  @ApiProperty({ description: 'Related finding IDs', type: [String], required: false })
  @IsOptional()
  findingIds?: string[];
}
