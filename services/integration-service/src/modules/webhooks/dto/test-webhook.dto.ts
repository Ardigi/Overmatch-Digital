import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class TestWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty()
  @IsObject()
  payload: any;
}
