import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DeliveryMethod } from '../entities/report-schedule.entity';

export class CreateScheduleDto {
  @ApiPropertyOptional({ description: 'Report template ID' })
  @IsOptional()
  @IsUUID()
  reportTemplateId?: string;

  @ApiPropertyOptional({ description: 'Template ID (alias for reportTemplateId)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ description: 'Schedule name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Schedule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cron expression for schedule' })
  @IsString()
  cronExpression: string;

  @ApiPropertyOptional({ description: 'Timezone for schedule execution' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ description: 'Email recipients', type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @ApiPropertyOptional({ description: 'Report format' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Delivery method', enum: DeliveryMethod })
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @ApiPropertyOptional({ description: 'Delivery configuration' })
  @IsOptional()
  @IsObject()
  deliveryConfig?: {
    emailSubject?: string;
    emailBody?: string;
    attachReport?: boolean;
    includeExecutiveSummary?: boolean;
    webhookUrl?: string;
    webhookHeaders?: Record<string, string>;
    storageLocation?: string;
    priority?: string;
    webhookPayload?: Record<string, any>;
    webhookAuth?: {
      type: 'bearer' | 'api-key' | 'basic';
      token?: string;
      key?: string;
      headerName?: string;
      username?: string;
      password?: string;
    };
    webhookTimeout?: number;
  };

  @ApiPropertyOptional({ description: 'Whether schedule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
