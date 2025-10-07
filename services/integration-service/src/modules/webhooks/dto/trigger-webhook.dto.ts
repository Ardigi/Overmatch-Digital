import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class TriggerWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty()
  @IsObject()
  data: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
