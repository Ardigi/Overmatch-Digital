import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FieldMappingDto {
  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  target: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  transform?: string;
}

export class RelationshipMappingDto {
  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  target: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  entity: string;
}

export class EntityMappingDto {
  @ApiProperty()
  @IsString()
  sourceEntity: string;

  @ApiProperty()
  @IsString()
  targetEntity: string;

  @ApiProperty({ type: [FieldMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fields: FieldMappingDto[];

  @ApiPropertyOptional({ type: [RelationshipMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelationshipMappingDto)
  @IsOptional()
  relationships?: RelationshipMappingDto[];

  @ApiPropertyOptional({ type: [FieldMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  @IsOptional()
  customMappings?: FieldMappingDto[];
}

export class UpdateEntityMappingsDto {
  // Map of entity names to their mapping configurations
  [entityName: string]: EntityMappingDto;
}
