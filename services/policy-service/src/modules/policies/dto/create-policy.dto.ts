import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PolicyPriority, PolicyScope, PolicyType } from '../entities/policy.entity';
import { PolicyContentDto, PolicySectionDto } from './policy-content.dto';

class PolicyRequirementDto {
  @IsString()
  requirement: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  mandatory: boolean;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  responsible?: string;
}

export class CreatePolicyDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @IsEnum(PolicyPriority)
  priority: PolicyPriority;

  @IsEnum(PolicyScope)
  scope: PolicyScope;

  @IsObject()
  @ValidateNested()
  @Type(() => PolicyContentDto)
  content: PolicyContentDto;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  nextReviewDate?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  ownerName: string;

  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  ownerDepartment?: string;

  @IsOptional()
  @IsUUID()
  delegateOwnerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stakeholders?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyRequirementDto)
  requirements?: PolicyRequirementDto[];

  @IsOptional()
  @IsObject()
  complianceMapping?: {
    frameworks?: string[];
    controls?: string[];
    mappingDetails?: Record<
      string,
      {
        implementation: string;
        strength: 'strong' | 'moderate' | 'weak';
        notes?: string;
      }
    >;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedPolicies?: string[];

  @IsOptional()
  @IsObject()
  implementation?: {
    steps?: Array<{
      phase: string;
      activities: string[];
      timeline?: string;
      responsible?: string;
    }>;
    training?: {
      required: boolean;
      frequency?: string;
      targetAudience?: string[];
    };
    monitoring?: {
      method: string;
      frequency: string;
      responsible?: string;
    };
  };

  @IsOptional()
  @IsObject()
  reviewCycle?: {
    frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'biennial';
  };

  @IsOptional()
  @IsObject()
  riskAssessment?: {
    inherentRisk?: {
      likelihood: number;
      impact: number;
    };
    riskFactors?: string[];
    mitigationMeasures?: string[];
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

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
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
