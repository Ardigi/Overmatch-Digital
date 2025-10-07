import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiKeyScope } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  @IsOptional()
  scopes?: ApiKeyScope[];

  @IsObject()
  @IsOptional()
  permissions?: {
    resources?: string[];
    actions?: string[];
    endpoints?: string[];
  };

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ipWhitelist?: string[];

  @IsNumber()
  @IsOptional()
  expiresIn?: number; // in seconds

  @IsNumber()
  @IsOptional()
  rateLimit?: number;

  @IsNumber()
  @IsOptional()
  rateLimitWindow?: number; // in seconds

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
