import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ReportFormat } from '../entities/report.entity';

export class CreateReportDto {
  @ApiPropertyOptional({ description: 'Template ID to use' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ description: 'Report type' })
  @IsString()
  reportType: string;

  @ApiProperty({ description: 'Report title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Report description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Output format', enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiPropertyOptional({ description: 'Report period start date' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Report period end date' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report sections' })
  @IsOptional()
  @IsArray()
  sections?: Array<{
    id: string;
    name: string;
    order: number;
  }>;

  @ApiPropertyOptional({ description: 'Report filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}
