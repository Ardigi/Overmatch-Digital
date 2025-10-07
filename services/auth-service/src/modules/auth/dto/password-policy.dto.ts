import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GetPasswordPolicyDto {
  @IsString()
  @IsOptional()
  organizationId?: string;
}

export class ValidatePasswordDto {
  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  organizationId?: string;
}

export class GeneratePasswordDto {
  @IsNumber()
  @Min(8)
  @IsOptional()
  length?: number;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
