import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AuditPhase, AuditStatus } from '../entities/soc-audit.entity';
import { CreateSOCAuditDto } from './create-soc-audit.dto';

export class UpdateSOCAuditDto extends PartialType(
  OmitType(CreateSOCAuditDto, ['auditNumber', 'clientId', 'organizationId', 'auditType'] as const)
) {
  @ApiPropertyOptional({ enum: AuditStatus })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({ enum: AuditPhase })
  @IsOptional()
  @IsEnum(AuditPhase)
  currentPhase?: AuditPhase;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  reportDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  actualCompletionDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalControls?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  testedControls?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  effectiveControls?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deficientControls?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overallRiskRating?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  draftReportUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finalReportUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  reportIssuedDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasQualifiedOpinion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  opinionModifications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  managementAssertionReceived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  managementAssertionDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managementAssertionDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  completionPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalFindings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  criticalFindings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  majorFindings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minorFindings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  remediatedFindings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  actualHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  actualCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  clientMeetingsHeld?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastClientCommunication?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextScheduledMeeting?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  peerReviewCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  peerReviewDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  peerReviewComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  qualityReviewPassed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  qualityReviewDate?: Date;
}
