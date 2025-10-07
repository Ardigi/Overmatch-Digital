import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class WebhookStatsQueryDto {
  @ApiPropertyOptional({ description: 'Number of hours to look back', default: 24 })
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  hours?: number = 24;
}
