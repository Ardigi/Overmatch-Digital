import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ScheduleWorkflowDto {
  @ApiProperty({
    description: 'Cron expression for schedule',
    example: '0 9 * * MON',
  })
  @IsString()
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
  )
  cron: string;

  @ApiPropertyOptional({
    description: 'Timezone for schedule',
    example: 'America/New_York',
  })
  @IsString()
  @IsOptional()
  timezone?: string = 'UTC';

  @ApiProperty({ description: 'Input parameters for scheduled execution' })
  @IsObject()
  inputs: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is schedule enabled', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  @ApiPropertyOptional({ description: 'Schedule metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Schedule description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  // These will be set by the service
  createdBy?: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Cron expression for schedule' })
  @IsString()
  @IsOptional()
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
  )
  cron?: string;

  @ApiPropertyOptional({ description: 'Timezone for schedule' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Input parameters for scheduled execution' })
  @IsObject()
  @IsOptional()
  inputs?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is schedule enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Schedule metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Schedule description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
