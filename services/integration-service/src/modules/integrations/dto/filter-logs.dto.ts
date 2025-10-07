import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { LogLevel, OperationType } from '../entities/integration-log.entity';

export class FilterLogsDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] })
  @IsEnum(['DEBUG', 'INFO', 'WARN', 'ERROR'])
  @IsOptional()
  logLevel?: LogLevel;

  @ApiPropertyOptional()
  @IsOptional()
  operationType?: OperationType;

  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  success?: boolean;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  limit?: number = 100;
}
