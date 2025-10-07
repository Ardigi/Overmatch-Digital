import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { RemediationStatus } from '../entities/remediation.entity';
import { CreateRemediationDto } from './create-remediation.dto';

export class UpdateRemediationDto extends PartialType(
  OmitType(CreateRemediationDto, ['clientId', 'organizationId', 'createdBy'] as const)
) {
  @IsEnum(RemediationStatus)
  @IsOptional()
  status?: RemediationStatus;

  @IsObject()
  @IsOptional()
  actualEffort?: {
    hours: number;
    percentComplete: number;
    startedAt?: Date;
    lastUpdatedAt?: Date;
  };

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  approvedBy?: string;

  @IsString()
  @IsOptional()
  completionNotes?: string;

  @IsNumber()
  @IsOptional()
  actualEffortHours?: number;

  @IsNumber()
  @IsOptional()
  percentComplete?: number;
}
