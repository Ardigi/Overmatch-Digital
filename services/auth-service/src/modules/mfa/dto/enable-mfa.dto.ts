import { ArrayMinSize, IsArray, IsNotEmpty, IsString, Matches } from 'class-validator';

export class EnableMfaDto {
  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Token must be a 6-digit code' })
  token: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  backupCodes: string[];
}
