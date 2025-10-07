import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { IntegrationStatus, IntegrationType } from '../entities/integration.entity';

export class FilterIntegrationDto {
  @ApiPropertyOptional({ enum: IntegrationStatus })
  @IsEnum(IntegrationStatus)
  @IsOptional()
  status?: IntegrationStatus;

  @ApiPropertyOptional({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  @IsOptional()
  type?: IntegrationType;

  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isHealthy?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsOptional()
  tags?: string[];
}
