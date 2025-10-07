import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import {
  ControlCategory,
  ControlFrequency,
  ControlPriority,
  ControlStatus,
  ControlType,
  ImplementationStatus,
} from '../entities/control.entity';

export class QueryControlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  frameworkId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  controlId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ControlType })
  @IsOptional()
  @IsEnum(ControlType)
  type?: ControlType;

  @ApiPropertyOptional({ enum: ControlPriority })
  @IsOptional()
  @IsEnum(ControlPriority)
  priority?: ControlPriority;

  @ApiPropertyOptional({ enum: ControlFrequency })
  @IsOptional()
  @IsEnum(ControlFrequency)
  frequency?: ControlFrequency;

  @ApiPropertyOptional({ enum: ImplementationStatus })
  @IsOptional()
  @IsEnum(ImplementationStatus)
  implementationStatus?: ImplementationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ enum: ControlStatus })
  @IsOptional()
  @IsEnum(ControlStatus)
  status?: ControlStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automationCapable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  testingDue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  minRiskScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  maxRiskScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeStats?: boolean;
}