import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ConfidentialityLevel, EvidenceSource, EvidenceType } from '../entities/evidence.entity';

class ComplianceMappingDto {
  @IsOptional()
  @IsArray()
  frameworks?: Array<{
    name: string;
    controls: string[];
    requirements?: string[];
    score?: number;
  }>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustServicesCriteria?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assertions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clauses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  safeguards?: string[];
}

class AccessControlDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  deniedUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deniedRoles?: string[];

  @IsOptional()
  @IsObject()
  externalAccess?: {
    auditorAccess: boolean;
    clientAccess: boolean;
    publicAccess: boolean;
  };
}

export class CreateEvidenceDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(EvidenceType)
  type: EvidenceType;

  @IsEnum(EvidenceSource)
  source: EvidenceSource;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsUUID()
  collectedBy?: string;

  @IsOptional()
  @IsString()
  hash?: string;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  auditId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsUUID()
  collectorId?: string;

  @IsOptional()
  @IsString()
  collectorType?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
    encoding?: string;
    dimensions?: { width: number; height: number };
    duration?: number;
    pageCount?: number;
    systemInfo?: {
      hostname?: string;
      ipAddress?: string;
      operatingSystem?: string;
      timestamp?: Date;
    };
    collectionMethod?: string;
    collectionParameters?: Record<string, any>;
    customFields?: Record<string, any>;
  };

  @IsOptional()
  @IsString()
  storageUrl?: string;

  @IsOptional()
  @IsString()
  storageProvider?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsOptional()
  @IsDateString()
  collectionDate?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComplianceMappingDto)
  complianceMapping?: ComplianceMappingDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDto)
  accessControl?: AccessControlDto;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsUUID()
  parentEvidenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsUUID()
  createdBy: string;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}
