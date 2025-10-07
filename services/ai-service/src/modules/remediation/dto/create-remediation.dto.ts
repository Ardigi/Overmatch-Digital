import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RemediationPriority, RemediationType } from '../entities/remediation.entity';

export class CreateRemediationDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ description: 'Finding ID this remediation addresses' })
  @IsUUID()
  @IsOptional()
  findingId?: string;

  @ApiProperty({ description: 'Remediation title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description' })
  @IsString()
  description: string;

  @ApiProperty({ enum: RemediationType, description: 'Type of remediation' })
  @IsEnum(RemediationType)
  type: RemediationType;

  @ApiProperty({ enum: RemediationPriority, description: 'Priority level' })
  @IsEnum(RemediationPriority)
  priority: RemediationPriority;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ description: 'Estimated effort' })
  @IsObject()
  @IsOptional()
  estimatedEffort?: {
    hours: number;
    complexity: 'low' | 'medium' | 'high' | 'very_high';
    resources?: number;
    cost?: number;
  };

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'User who created the remediation' })
  @IsUUID()
  createdBy: string;
}
