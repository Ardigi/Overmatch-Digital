import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

export class InternalUpdateUserDto extends UpdateUserDto {
  @IsDate()
  @IsOptional()
  lastLoginAt?: Date;

  @IsString()
  @IsOptional()
  lastLoginIp?: string;

  @IsDate()
  @IsOptional()
  emailVerifiedAt?: Date;

  @IsDate()
  @IsOptional()
  passwordChangedAt?: Date;

  @IsNumber()
  @IsOptional()
  failedLoginAttempts?: number;

  @IsDate()
  @IsOptional()
  lockedUntil?: Date;

  @IsBoolean()
  @IsOptional()
  mfaEnabled?: boolean;

  @IsString()
  @IsOptional()
  mfaSecret?: string;

  @IsString({ each: true })
  @IsOptional()
  mfaBackupCodes?: string[];
}
