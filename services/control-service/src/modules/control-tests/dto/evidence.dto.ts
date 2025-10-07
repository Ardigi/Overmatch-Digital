import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { EvidenceType } from '@soc-compliance/contracts';

export enum EvidenceVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum EvidenceClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

export class EvidenceDto {
  @ApiProperty({ description: 'Evidence name/title' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Evidence description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Evidence type', enum: EvidenceType })
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @ApiProperty({ description: 'File URL or storage location' })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'File hash for integrity verification' })
  @IsString()
  hash: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @ApiProperty({ description: 'MIME type', required: false })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiProperty({ description: 'Date when evidence was collected' })
  @IsDateString()
  collectedAt: string;

  @ApiProperty({ description: 'User ID who collected the evidence' })
  @IsUUID()
  collectedBy: string;

  @ApiProperty({ description: 'Whether evidence has been verified', required: false })
  @IsBoolean()
  @IsOptional()
  verified?: boolean;

  @ApiProperty({ description: 'Verification status', enum: EvidenceVerificationStatus, required: false })
  @IsEnum(EvidenceVerificationStatus)
  @IsOptional()
  verificationStatus?: EvidenceVerificationStatus;

  @ApiProperty({ description: 'User ID who verified the evidence', required: false })
  @IsUUID()
  @IsOptional()
  verifiedBy?: string;

  @ApiProperty({ description: 'Verification date', required: false })
  @IsDateString()
  @IsOptional()
  verifiedAt?: string;

  @ApiProperty({ description: 'Evidence expiry date', required: false })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiProperty({ description: 'Data classification', enum: EvidenceClassification, required: false })
  @IsEnum(EvidenceClassification)
  @IsOptional()
  classification?: EvidenceClassification;

  @ApiProperty({ description: 'Retention period in days', required: false })
  @IsNumber()
  @IsOptional()
  retentionDays?: number;

  @ApiProperty({ description: 'Evidence collection method', required: false })
  @IsString()
  @IsOptional()
  collectionMethod?: string;

  @ApiProperty({ description: 'System source of evidence', required: false })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({ description: 'Evidence version', required: false })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Chain of custody information', required: false })
  @IsString()
  @IsOptional()
  chainOfCustody?: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tags for categorization', type: [String], required: false })
  @IsOptional()
  tags?: string[];
}
