import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import type { WebhookConfig } from '../entities/webhook-endpoint.entity';

export class WebhookRetryPolicyDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  maxRetries: number;

  @ApiProperty()
  @IsNumber()
  @Min(100)
  retryDelay: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  backoffMultiplier: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1000)
  @IsOptional()
  maxRetryDelay?: number;
}

export class WebhookAuthenticationDto {
  @ApiProperty({ enum: ['none', 'api_key', 'bearer', 'signature', 'custom'] })
  @IsEnum(['none', 'api_key', 'bearer', 'signature', 'custom'])
  type: 'none' | 'api_key' | 'bearer' | 'signature' | 'custom';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  algorithm?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headerName?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customConfig?: Record<string, any>;
}

export class WebhookTransformationsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludeFields?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  includeFields?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, string>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customTransform?: string;
}

export class WebhookConfigDto implements WebhookConfig {
  @ApiProperty({ enum: ['POST', 'PUT', 'PATCH'], default: 'POST' })
  @IsEnum(['POST', 'PUT', 'PATCH'])
  @IsOptional()
  method: 'POST' | 'PUT' | 'PATCH' = 'POST';

  @ApiProperty()
  @IsObject()
  headers: Record<string, string>;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiProperty({ type: WebhookRetryPolicyDto })
  @ValidateNested()
  @Type(() => WebhookRetryPolicyDto)
  retryPolicy: WebhookRetryPolicyDto;

  @ApiPropertyOptional({ type: WebhookAuthenticationDto })
  @ValidateNested()
  @Type(() => WebhookAuthenticationDto)
  @IsOptional()
  authentication?: WebhookAuthenticationDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ type: WebhookTransformationsDto })
  @ValidateNested()
  @Type(() => WebhookTransformationsDto)
  @IsOptional()
  transformations?: WebhookTransformationsDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export class CreateWebhookDto {
  @ApiPropertyOptional({ description: 'Organization ID (added from auth context if not provided)' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  integrationId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiProperty({ type: WebhookConfigDto })
  @ValidateNested()
  @Type(() => WebhookConfigDto)
  config: WebhookConfigDto;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  sslVerification?: boolean = true;

  @ApiPropertyOptional({ default: 30 })
  @IsNumber()
  @Min(5)
  @IsOptional()
  timeoutSeconds?: number = 30;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
