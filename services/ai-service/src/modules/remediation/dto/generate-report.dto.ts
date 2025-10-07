import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ description: 'Client ID for the report' })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    description: 'Report type',
    enum: [
      'executive_summary',
      'detailed_progress',
      'compliance_status',
      'technical_implementation',
    ],
  })
  @IsEnum([
    'executive_summary',
    'detailed_progress',
    'compliance_status',
    'technical_implementation',
  ])
  reportType: string;

  @ApiPropertyOptional({ description: 'Date range for the report' })
  @IsObject()
  @IsOptional()
  dateRange?: {
    start: Date;
    end: Date;
  };

  @ApiPropertyOptional({ description: 'Include specific remediation IDs' })
  @IsOptional()
  remediationIds?: string[];

  @ApiPropertyOptional({ description: 'Report format' })
  @IsEnum(['json', 'pdf', 'excel', 'markdown'])
  @IsOptional()
  format?: string;

  @ApiPropertyOptional({ description: 'Include charts and visualizations' })
  @IsOptional()
  includeVisualizations?: boolean;
}
