import { IsArray, IsObject, IsUUID } from 'class-validator';
import { UpdateEvidenceDto } from './update-evidence.dto';

export class BulkUpdateEvidenceDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsObject()
  data: Partial<UpdateEvidenceDto>;
}
