import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { CredentialType } from '../entities/integration-credential.entity';

export class CreateCredentialDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: CredentialType })
  @IsEnum(CredentialType)
  credentialType: CredentialType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scope?: string[];
  };

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  @ApiPropertyOptional({ default: 'production' })
  @IsString()
  @IsOptional()
  environment?: string = 'production';

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class RotateCredentialDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: Date;
}
