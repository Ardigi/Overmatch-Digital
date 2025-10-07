import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SyncOptionsDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  batchSize?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  parallel?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  retryFailures?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  continueOnError?: boolean;
}

export class StartSyncDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  entities?: string[];

  @ApiPropertyOptional({ enum: ['full', 'incremental', 'delta'] })
  @IsEnum(['full', 'incremental', 'delta'])
  @IsOptional()
  mode?: 'full' | 'incremental' | 'delta';

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ type: SyncOptionsDto })
  @ValidateNested()
  @Type(() => SyncOptionsDto)
  @IsOptional()
  options?: SyncOptionsDto;

  @ApiPropertyOptional({ description: 'User or system that triggered the sync' })
  @IsString()
  @IsOptional()
  triggeredBy?: string;

  @ApiPropertyOptional({ description: 'Schedule ID if this is a scheduled sync' })
  @IsString()
  @IsOptional()
  schedule?: string;
}
