import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ProcessIncomingWebhookDto {
  @ApiProperty()
  @IsObject()
  payload: any;

  @ApiProperty()
  @IsObject()
  headers: Record<string, string>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  signature?: string;
}
