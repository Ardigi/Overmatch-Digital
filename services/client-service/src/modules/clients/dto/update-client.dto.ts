import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ComplianceStatus } from '../entities/client.entity';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ['organizationId'] as const)
) {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  website?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000000)
  employeeCount?: number;
  @IsOptional()
  @IsEnum(ComplianceStatus)
  complianceStatus?: ComplianceStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  complianceScore?: number;

  @IsOptional()
  @IsDateString()
  onboardingStartDate?: string;

  @IsOptional()
  @IsDateString()
  onboardingCompleteDate?: string;

  @IsOptional()
  @IsDateString()
  firstAuditDate?: string;

  @IsOptional()
  @IsDateString()
  lastAuditDate?: string;

  @IsOptional()
  @IsDateString()
  nextAuditDate?: string;

  @IsOptional()
  @IsDateString()
  certificateExpiryDate?: string;

  @IsOptional()
  @IsObject()
  integrations?: {
    aws?: {
      accountId?: string;
      regions?: string[];
      lastSync?: Date;
    };
    azure?: {
      tenantId?: string;
      subscriptions?: string[];
      lastSync?: Date;
    };
    gcp?: {
      projectIds?: string[];
      lastSync?: Date;
    };
    jira?: {
      url?: string;
      projectKey?: string;
      lastSync?: Date;
    };
    slack?: {
      workspaceId?: string;
      channels?: string[];
    };
  };
}
