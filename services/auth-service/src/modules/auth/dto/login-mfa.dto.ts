import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginMfaDto {
  @IsString()
  @IsNotEmpty()
  mfaSessionToken: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 16) // 6 digits for TOTP, up to 16 for backup codes
  mfaToken: string;
}
