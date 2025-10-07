import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
import {
  AuthType,
  HealthCheckConfig,
  IntegrationConfiguration,
  IntegrationType,
} from '../entities/integration.entity';

export class OAuth2ConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  @ApiProperty()
  @IsUrl()
  authorizationUrl: string;

  @ApiProperty()
  @IsUrl()
  tokenUrl: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  scope: string[];

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  redirectUri?: string;
}

export class SyncSettingsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  entities: string[];

  @ApiProperty()
  @IsNumber()
  @Min(1)
  syncInterval: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  batchSize: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;
}

export class IntegrationConfigurationDto {
  @ApiProperty()
  @IsUrl()
  apiUrl: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  apiVersion?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ type: OAuth2ConfigDto })
  @ValidateNested()
  @Type(() => OAuth2ConfigDto)
  @IsOptional()
  oauth2Config?: OAuth2ConfigDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  basicAuth?: {
    username: string;
    password: string;
  };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ type: SyncSettingsDto })
  @ValidateNested()
  @Type(() => SyncSettingsDto)
  @IsOptional()
  syncSettings?: SyncSettingsDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customHeaders?: Record<string, string>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  customConfig?: Record<string, any>;
}

export class HealthCheckConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty()
  @IsNumber()
  @Min(60)
  interval: number;

  @ApiProperty()
  @IsNumber()
  @Min(5)
  timeout: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  successCriteria?: {
    statusCode?: number;
    responseContains?: string;
  };
}

export class CreateIntegrationDto {
  @ApiPropertyOptional({ description: 'Organization ID (added from auth context if not provided)' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  integrationType: IntegrationType;

  @ApiProperty({ enum: AuthType })
  @IsEnum(AuthType)
  authType: AuthType;

  @ApiProperty({ type: IntegrationConfigurationDto })
  @ValidateNested()
  @Type(() => IntegrationConfigurationDto)
  configuration: IntegrationConfigurationDto;

  @ApiPropertyOptional({ type: HealthCheckConfigDto })
  @ValidateNested()
  @Type(() => HealthCheckConfigDto)
  @IsOptional()
  healthCheck?: HealthCheckConfigDto;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'User ID of the creator (added from auth context if not provided)',
  })
  @IsString()
  @IsOptional()
  createdBy?: string;
}
