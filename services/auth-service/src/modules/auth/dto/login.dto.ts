import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class DeviceFingerprintDto {
  @IsString()
  @IsOptional()
  screenResolution?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsOptional()
  colorDepth?: number;

  @IsOptional()
  hardwareConcurrency?: number;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsOptional()
  plugins?: string[];

  @IsString()
  @IsOptional()
  canvas?: string;

  @IsString()
  @IsOptional()
  webgl?: string;

  @IsOptional()
  fonts?: string[];

  @IsString()
  @IsOptional()
  audio?: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  mfaToken?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceFingerprintDto)
  deviceFingerprint?: DeviceFingerprintDto;
}
