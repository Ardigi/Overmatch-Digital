import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportFormat } from '../entities/report.entity';

export class GenerateReportDto {
  @ApiProperty({ description: 'Template ID to use for generation' })
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional({ description: 'Report type' })
  @IsOptional()
  @IsString()
  reportType?: string;

  @ApiPropertyOptional({ description: 'Report title or name' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Report name (alias for title)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Report description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Output format', enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report sections to include' })
  @IsOptional()
  @IsArray()
  sections?: string[] | Array<{ id: string; name: string; content?: string }>;

  @ApiPropertyOptional({ description: 'Filters to apply' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}
