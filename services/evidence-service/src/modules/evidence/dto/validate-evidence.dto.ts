import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ValidateEvidenceDto {
  @IsBoolean()
  isValid: boolean;

  @IsUUID()
  validatedBy: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  validationComments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
