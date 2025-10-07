import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';
import { CreatePreferenceDto } from './create-preference.dto';

export class UpdatePreferenceDto extends PartialType(
  OmitType(CreatePreferenceDto, ['userId'] as const)
) {
  @IsOptional()
  @IsBoolean()
  optedOut?: boolean;

  @IsOptional()
  @IsString()
  optOutReason?: string;
}

export class OptOutDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  until?: Date;
}
