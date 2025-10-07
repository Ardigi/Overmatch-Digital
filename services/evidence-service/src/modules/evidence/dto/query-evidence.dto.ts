import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ConfidentialityLevel,
  EvidenceSource,
  EvidenceStatus,
  EvidenceType,
} from '../entities/evidence.entity';

export class QueryEvidenceDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

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
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsArray()
  @IsEnum(EvidenceType, { each: true })
  types?: EvidenceType[];

  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsArray()
  @IsEnum(EvidenceStatus, { each: true })
  statuses?: EvidenceStatus[];

  @IsOptional()
  @IsEnum(EvidenceSource)
  source?: EvidenceSource;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  collectionDateFrom?: string;

  @IsOptional()
  @IsDateString()
  collectionDateTo?: string;

  @IsOptional()
  @IsDateString()
  collectedFrom?: string;

  @IsOptional()
  @IsDateString()
  collectedTo?: string;

  @IsOptional()
  @IsDateString()
  effectiveDateFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveDateTo?: string;

  @IsOptional()
  @IsDateString()
  expirationDateFrom?: string;

  @IsOptional()
  @IsDateString()
  expirationDateTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  expiringSoon?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isLatestVersion?: boolean;

  @IsOptional()
  @IsString()
  framework?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsUUID()
  collectedBy?: string;

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
  minQualityScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxQualityScore?: number;

  @IsOptional()
  @IsString()
  collectorType?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeVersionHistory?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeMetrics?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;
}
