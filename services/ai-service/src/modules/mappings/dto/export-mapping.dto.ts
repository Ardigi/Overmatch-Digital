import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ExportMappingDto {
  @ApiProperty({ description: 'Export format (json/csv/excel/xlsx)' })
  @IsString()
  format: string;

  @ApiPropertyOptional({ description: 'Include analysis data' })
  @IsBoolean()
  @IsOptional()
  includeAnalysis?: boolean;
}
