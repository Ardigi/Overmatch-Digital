import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @IsString()
  @IsOptional()
  device_id?: string;
}

export class RevokeTokenDto {
  @IsString()
  @IsOptional()
  refresh_token?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
