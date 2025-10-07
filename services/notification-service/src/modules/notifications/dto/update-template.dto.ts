import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(
  OmitType(CreateTemplateDto, ['code', 'channel'] as const)
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
