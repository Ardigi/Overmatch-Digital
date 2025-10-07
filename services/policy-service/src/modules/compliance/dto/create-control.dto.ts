import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ControlCategory,
  ControlFrequency,
  ControlPriority,
  ControlType,
  ImplementationStatus,
} from '../entities/control.entity';
import type { ControlMetadata } from '../../policies/types/policy.types';

export class CreateControlDto {
  @ApiProperty()
  @IsUUID()
  frameworkId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  controlId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  identifier: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  category: string; // Test expects string, not enum

  @ApiProperty({ enum: ControlType })
  @IsEnum(ControlType)
  type: ControlType;

  @ApiProperty({ enum: ControlPriority })
  @IsEnum(ControlPriority)
  priority: ControlPriority;

  @ApiProperty({ enum: ControlFrequency })
  @IsEnum(ControlFrequency)
  frequency: ControlFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  implementationGuidance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assessmentCriteria?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  references?: string[];

  @ApiPropertyOptional({ enum: ImplementationStatus })
  @IsOptional()
  @IsEnum(ImplementationStatus)
  implementationStatus?: ImplementationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidenceRequirements?: {
    type: string;
    description: string;
    frequency?: string;
    retentionPeriod?: string;
  }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  automationCapabilities?: {
    isAutomatable: boolean;
    automationTools?: string[];
    apiIntegration?: boolean;
    scriptingSupport?: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: ControlMetadata;
}
