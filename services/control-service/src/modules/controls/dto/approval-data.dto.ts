import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum ApprovalType {
  IMPLEMENTATION = 'IMPLEMENTATION',
  DESIGN = 'DESIGN',
  EFFECTIVENESS = 'EFFECTIVENESS',
  EXCEPTION = 'EXCEPTION',
  REMEDIATION = 'REMEDIATION',
}

export enum ApprovalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class ApprovalStakeholderDto {
  @ApiProperty({ description: 'Stakeholder user ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Stakeholder role' })
  @IsString()
  role: string;

  @ApiProperty({ description: 'Whether approval is required from this stakeholder' })
  @IsOptional()
  required?: boolean;
}

export class ApprovalDataDto {
  @ApiProperty({ description: 'Type of approval request', enum: ApprovalType })
  @IsEnum(ApprovalType)
  type: ApprovalType;

  @ApiProperty({ description: 'Priority level', enum: ApprovalPriority })
  @IsEnum(ApprovalPriority)
  priority: ApprovalPriority;

  @ApiProperty({ description: 'Approval request title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description of what needs approval' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Justification for the approval request' })
  @IsString()
  justification: string;

  @ApiProperty({ description: 'Requestor user ID' })
  @IsUUID()
  requestorId: string;

  @ApiProperty({ description: 'Target completion date', required: false })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiProperty({ description: 'Supporting evidence IDs', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  evidenceIds?: string[];

  @ApiProperty({ description: 'Related control IDs', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  relatedControlIds?: string[];

  @ApiProperty({ description: 'Approval stakeholders', type: [ApprovalStakeholderDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStakeholderDto)
  @IsOptional()
  stakeholders?: ApprovalStakeholderDto[];

  @ApiProperty({ description: 'Business impact if not approved', required: false })
  @IsString()
  @IsOptional()
  businessImpact?: string;

  @ApiProperty({ description: 'Risk assessment if not approved', required: false })
  @IsString()
  @IsOptional()
  riskAssessment?: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}
