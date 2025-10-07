import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type { NotificationChannel } from '../entities/notification.entity';
import type {
  ChannelPreference,
  DoNotDisturbSettings,
} from '../entities/notification-preference.entity';

export class QuietHoursDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  startTime: string; // HH:mm format

  @IsString()
  endTime: string;

  @IsString()
  timezone: string;

  @IsOptional()
  @IsArray()
  days?: number[];
}

export class ChannelPreferenceDto implements Partial<ChannelPreference> {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  frequency?: 'immediate' | 'digest' | 'weekly' | 'never';

  @IsOptional()
  @IsObject()
  categories?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  types?: Record<string, boolean>;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;
}

export class DoNotDisturbDto implements DoNotDisturbSettings {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Type(() => Date)
  until?: Date;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePreferenceDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  channels?: {
    [key in NotificationChannel]?: ChannelPreferenceDto;
  };

  @IsOptional()
  @ValidateNested()
  @Type(() => DoNotDisturbDto)
  doNotDisturb?: DoNotDisturbDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  blockedUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedSources?: string[];

  @IsOptional()
  @IsObject()
  customSettings?: Record<string, any>;
}
