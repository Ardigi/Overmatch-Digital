import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
} from '../entities/notification.entity';
import type { TemplateContent, TemplateVariable } from '../entities/notification-template.entity';

export class TemplateVariableDto implements TemplateVariable {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsEnum(['string', 'number', 'boolean', 'date', 'array', 'object'])
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  default?: any;

  @IsOptional()
  example?: any;
}

export class TemplateContentDto implements TemplateContent {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  smsBody?: string;

  @IsOptional()
  @IsArray()
  slackBlocks?: any[];

  @IsOptional()
  @IsObject()
  teamsCard?: any;

  @IsObject()
  variables: Record<string, TemplateVariable>;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ValidateNested()
  @Type(() => TemplateContentDto)
  content: TemplateContentDto;

  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    category?: string;
    author?: string;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsObject()
  defaultVariables?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedLocales?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultLocale?: string = 'en';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number = 100;

  @IsOptional()
  @IsBoolean()
  isTransactional?: boolean = false;
}
