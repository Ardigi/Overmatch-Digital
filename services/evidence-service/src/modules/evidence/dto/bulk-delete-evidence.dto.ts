import { IsArray, IsUUID } from 'class-validator';

export class BulkDeleteEvidenceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
