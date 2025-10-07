import { OmitType, PartialType } from '@nestjs/swagger';
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
import { PolicyStatus } from '../entities/policy.entity';
import { CreatePolicyDto } from './create-policy.dto';

export class UpdatePolicyDto extends PartialType(
  OmitType(CreatePolicyDto, ['organizationId', 'createdBy'] as const)
) {
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @IsOptional()
  @IsDateString()
  lastReviewDate?: string;

  @IsOptional()
  @IsDateString()
  approvalDate?: string;

  @IsOptional()
  @IsDateString()
  publishedDate?: string;

  @IsOptional()
  @IsObject()
  approvalWorkflow?: {
    steps: Array<{
      order: number;
      role: string;
      approver?: string;
      status: 'pending' | 'approved' | 'rejected';
      date?: Date;
      comments?: string;
    }>;
    currentStep?: number;
    requiredApprovals?: number;
    receivedApprovals?: number;
  };

  @IsOptional()
  @IsArray()
  exceptions?: Array<{
    description: string;
    justification: string;
    approvedBy: string;
    approvalDate: Date;
    expirationDate?: Date;
    conditions?: string[];
  }>;

  @IsOptional()
  @IsObject()
  metrics?: {
    attestations?: {
      required: number;
      completed: number;
      percentage: number;
      overdue?: number;
    };
    violations?: {
      total: number;
      byLevel?: Record<string, number>;
      trending?: 'increasing' | 'stable' | 'decreasing';
    };
    training?: {
      required: number;
      completed: number;
      percentage: number;
      averageScore?: number;
    };
    effectiveness?: {
      score: number;
      factors?: Record<string, number>;
      lastAssessment?: Date;
    };
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supersededPolicies?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  complianceScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adoptionRate?: number;

  @IsOptional()
  @IsString()
  regoPolicy?: string;

  @IsOptional()
  @IsObject()
  opaMetadata?: {
    package?: string;
    imports?: string[];
  };

  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}
