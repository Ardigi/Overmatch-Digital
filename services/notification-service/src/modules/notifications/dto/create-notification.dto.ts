import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  NotificationCategory,
  NotificationChannel,
  type NotificationContent,
  NotificationPriority,
  type NotificationRecipient,
  NotificationType,
} from '../entities/notification.entity';

export class RecipientDto implements Partial<NotificationRecipient> {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsMobilePhone()
  phone?: string;

  @IsOptional()
  @IsString()
  slackUserId?: string;

  @IsOptional()
  @IsString()
  teamsUserId?: string;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ContentDto implements NotificationContent {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class AttachmentDto {
  @IsString()
  filename: string;

  @IsString()
  content: string;

  @IsString()
  contentType: string;

  @IsOptional()
  @IsString()
  encoding?: string;
}

export class ActionDto {
  @IsString()
  label: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsEnum(['primary', 'secondary', 'danger'])
  style?: 'primary' | 'secondary' | 'danger';
}

export class CreateNotificationDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ValidateNested()
  @Type(() => RecipientDto)
  recipient: RecipientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentDto)
  content?: ContentDto;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledFor?: Date;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsBoolean()
  isTransactional?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  context?: {
    source?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateBulkNotificationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNotificationDto)
  @ArrayMinSize(1)
  notifications: CreateNotificationDto[];

  @IsOptional()
  @IsString()
  batchId?: string;
}
