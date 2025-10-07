import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationStatus } from '../entities/notification.entity';
import { CreateNotificationDto } from './create-notification.dto';

export class UpdateNotificationDto extends PartialType(
  OmitType(CreateNotificationDto, ['channel', 'type', 'recipient', 'templateId'] as const)
) {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  sentAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deliveredAt?: Date;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  lastError?: string;
}
