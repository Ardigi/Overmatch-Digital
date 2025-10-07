import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class RetrySyncDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  entities?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  retryFailedOnly?: boolean;
}
