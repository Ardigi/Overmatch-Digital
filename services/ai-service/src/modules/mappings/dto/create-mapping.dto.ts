import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MappingType } from '../entities/framework-mapping.entity';

export class ControlMappingDto {
  @ApiProperty({ description: 'Source control identifier' })
  @IsString()
  sourceControl: string;

  @ApiProperty({ description: 'Target control identifier' })
  @IsString()
  targetControl: string;

  @ApiProperty({ enum: MappingType, description: 'Type of mapping' })
  @IsEnum(MappingType)
  mappingType: MappingType;

  @ApiPropertyOptional({ description: 'Similarity score (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarity?: number;

  @ApiPropertyOptional({ description: 'Confidence score (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Mapping rationale' })
  @IsString()
  @IsOptional()
  rationale?: string;
}

export class CreateMappingDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Source framework name' })
  @IsString()
  sourceFramework: string;

  @ApiProperty({ description: 'Target framework name' })
  @IsString()
  targetFramework: string;

  @ApiProperty({ type: [ControlMappingDto], description: 'Control mappings' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ControlMappingDto)
  mappings: ControlMappingDto[];

  @ApiPropertyOptional({ description: 'Description of the mapping' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'User who created the mapping' })
  @IsUUID()
  createdBy: string;
}
