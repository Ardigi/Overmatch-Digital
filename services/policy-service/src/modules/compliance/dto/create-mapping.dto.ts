import { IsArray, IsOptional, IsString, IsUUID, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MappingEntryDto {
  @IsString()
  sourceControlId: string;

  @IsString()
  targetControlId: string;

  @IsString()
  @IsOptional()
  mappingType?: 'equivalent' | 'partial' | 'related';

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  rationale?: string;
}

export class CreateMappingDto {
  @IsUUID()
  sourceFrameworkId: string;

  @IsUUID()
  targetFrameworkId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingEntryDto)
  mappings: MappingEntryDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
