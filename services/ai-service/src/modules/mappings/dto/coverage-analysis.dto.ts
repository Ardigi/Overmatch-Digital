import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CoverageAnalysisDto {
  @ApiProperty({ description: 'Mapping ID to analyze' })
  @IsUUID()
  mappingId: string;

  @ApiPropertyOptional({ description: 'Include category breakdown' })
  @IsBoolean()
  @IsOptional()
  includeCategories?: boolean;

  @ApiPropertyOptional({ description: 'Include heatmap visualization' })
  @IsBoolean()
  @IsOptional()
  includeHeatmap?: boolean;
}
