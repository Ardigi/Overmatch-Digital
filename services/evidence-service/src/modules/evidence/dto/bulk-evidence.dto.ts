import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { EvidenceStatus } from '../entities/evidence.entity';

class BulkUpdateData {
  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;

  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class BulkUpdateEvidenceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  ids: string[];

  @ValidateNested()
  @Type(() => BulkUpdateData)
  data: BulkUpdateData;
}

export class BulkDeleteEvidenceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  ids: string[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  deletedBy?: string;
}

export class BulkValidateEvidenceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  evidenceIds: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  validationRuleIds?: string[];

  @IsOptional()
  @IsString()
  validationProfile?: string;

  @IsUUID()
  validatedBy: string;
}

class CollectionItemDto {
  @IsString()
  collectorType: string;

  @IsString()
  collectorId: string;

  @IsOptional()
  @IsString()
  evidenceType?: string;

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
  parameters?: Record<string, any>;
}

export class BulkCollectEvidenceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: CollectionItemDto[];

  @IsOptional()
  @IsUUID()
  collectedBy?: string;
}
