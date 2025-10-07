import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
import {
  AuditAction,
  type AuditContext,
  type AuditMetadata,
  AuditResource,
  AuditSeverity,
} from '../entities/audit-entry.entity';

export class CreateAuditEntryDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  userEmail: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userRole?: string;

  @ApiProperty({ enum: AuditAction })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({ enum: AuditResource })
  @IsEnum(AuditResource)
  resource: AuditResource;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  resourceId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resourceName?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: AuditSeverity, default: AuditSeverity.INFO })
  @IsEnum(AuditSeverity)
  @IsOptional()
  severity?: AuditSeverity;

  @ApiProperty()
  @IsDateString()
  timestamp: Date;

  @ApiProperty()
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  oldValue?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  newValue?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  changes?: Record<string, { old: any; new: any }>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  context?: AuditContext;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: AuditMetadata;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  failureReason?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  affectedUsers?: string[];

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  relatedEntries?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAnomaly?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  anomalyReason?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  riskScore?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  requiresReview?: boolean;
}
