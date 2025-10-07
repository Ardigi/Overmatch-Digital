import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsArray, IsNumber, Min, Max } from 'class-validator';

export enum FindingSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FindingStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  DEFERRED = 'DEFERRED',
}

export enum FindingType {
  CONTROL_DEFICIENCY = 'CONTROL_DEFICIENCY',
  SIGNIFICANT_DEFICIENCY = 'SIGNIFICANT_DEFICIENCY',
  MATERIAL_WEAKNESS = 'MATERIAL_WEAKNESS',
  OBSERVATION = 'OBSERVATION',
  EXCEPTION = 'EXCEPTION',
}

export class FindingDto {
  @ApiProperty({ description: 'Finding title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed finding description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Finding type', enum: FindingType })
  @IsEnum(FindingType)
  type: FindingType;

  @ApiProperty({ description: 'Finding severity', enum: FindingSeverity })
  @IsEnum(FindingSeverity)
  severity: FindingSeverity;

  @ApiProperty({ description: 'Root cause analysis' })
  @IsString()
  rootCause: string;

  @ApiProperty({ description: 'Impact assessment' })
  @IsString()
  impact: string;

  @ApiProperty({ description: 'Risk rating (1-10)', minimum: 1, maximum: 10, required: false })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  riskRating?: number;

  @ApiProperty({ description: 'Detailed recommendation for remediation' })
  @IsString()
  recommendation: string;

  @ApiProperty({ description: 'Management response', required: false })
  @IsString()
  @IsOptional()
  managementResponse?: string;

  @ApiProperty({ description: 'Target remediation date', required: false })
  @IsDateString()
  @IsOptional()
  targetRemediationDate?: string;

  @ApiProperty({ description: 'Actual remediation date', required: false })
  @IsDateString()
  @IsOptional()
  actualRemediationDate?: string;

  @ApiProperty({ description: 'Finding status', enum: FindingStatus, required: false })
  @IsEnum(FindingStatus)
  @IsOptional()
  status?: FindingStatus;

  @ApiProperty({ description: 'Assigned to user ID', required: false })
  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @ApiProperty({ description: 'Reporter/auditor user ID', required: false })
  @IsUUID()
  @IsOptional()
  reportedBy?: string;

  @ApiProperty({ description: 'Remediation effort estimate in hours', required: false })
  @IsNumber()
  @IsOptional()
  estimatedEffort?: number;

  @ApiProperty({ description: 'Actual remediation effort in hours', required: false })
  @IsNumber()
  @IsOptional()
  actualEffort?: number;

  @ApiProperty({ description: 'Related evidence IDs', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  evidenceIds?: string[];

  @ApiProperty({ description: 'Related control IDs', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  relatedControlIds?: string[];

  @ApiProperty({ description: 'Additional finding notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Business process affected', required: false })
  @IsString()
  @IsOptional()
  businessProcess?: string;

  @ApiProperty({ description: 'System components affected', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  systemComponents?: string[];
}
