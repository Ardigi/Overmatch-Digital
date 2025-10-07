import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
import { AuditAction, AuditResource, AuditSeverity } from '../entities/audit-entry.entity';

export class SearchAuditEntriesDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditResource })
  @IsEnum(AuditResource)
  @IsOptional()
  resource?: AuditResource;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  resourceId?: string;

  @ApiPropertyOptional({ enum: AuditSeverity })
  @IsEnum(AuditSeverity)
  @IsOptional()
  severity?: AuditSeverity;

  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  success?: boolean;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  requiresReview?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  pageSize: number = 50;
}
