import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';
import type { SyncConfig } from '../entities/sync-schedule.entity';

export class SyncConfigDto implements SyncConfig {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  entities: string[];

  @ApiProperty({ enum: ['full', 'incremental', 'delta'] })
  mode: 'full' | 'incremental' | 'delta';

  @ApiPropertyOptional()
  batchSize?: number;

  @ApiPropertyOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class CreateScheduleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @ApiPropertyOptional({ default: 'UTC' })
  @IsString()
  timezone?: string = 'UTC';

  @ApiProperty({ type: SyncConfigDto })
  @ValidateNested()
  @Type(() => SyncConfigDto)
  syncConfig: SyncConfigDto;
}
