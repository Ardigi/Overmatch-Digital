import { Type } from 'class-transformer';
import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { MappingEntryDto } from './create-mapping.dto';

export class BulkMappingDto {
  @IsUUID()
  sourceFrameworkId: string;

  @IsUUID()
  targetFrameworkId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingEntryDto)
  mappings: MappingEntryDto[];
}
