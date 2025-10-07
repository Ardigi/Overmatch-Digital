import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EvidenceStatus } from '../entities/evidence.entity';
import { CreateEvidenceDto } from './create-evidence.dto';

export class UpdateEvidenceDto extends PartialType(
  OmitType(CreateEvidenceDto, ['clientId', 'type', 'source', 'createdBy'] as const)
) {
  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsDateString()
  reviewedDate?: string;

  @IsOptional()
  @IsDateString()
  approvedDate?: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;

  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @IsOptional()
  @IsObject()
  validationResults?: {
    passed: boolean;
    checks: Array<{
      name: string;
      result: 'pass' | 'fail' | 'warning' | 'skipped';
      message?: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
      timestamp: Date;
    }>;
    summary?: {
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      warnings: number;
    };
  };

  @IsOptional()
  @IsArray()
  reviewComments?: Array<{
    userId: string;
    userName: string;
    comment: string;
    type: 'question' | 'concern' | 'suggestion' | 'approval' | 'rejection';
  }>;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}
