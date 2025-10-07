import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AuditAction, AuditResourceType } from '../entities/audit-trail.entity';

export class CreateAuditTrailDto {
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsEnum(AuditResourceType)
  resourceType: AuditResourceType;

  @IsUUID()
  resourceId: string;

  @IsOptional()
  @IsString()
  resourceName?: string;

  @IsUUID()
  userId: string;

  @IsString()
  userName: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsString()
  userRole?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };

  @IsOptional()
  @IsObject()
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    duration?: number;
    errorMessage?: string;
    tags?: string[];
  };

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsBoolean()
  isSystemAction?: boolean;

  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsString()
  complianceFramework?: string;

  @IsOptional()
  @IsString()
  controlId?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
