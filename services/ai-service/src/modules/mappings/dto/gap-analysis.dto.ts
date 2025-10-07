import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class GapAnalysisDto {
  @ApiProperty({ description: 'Mapping ID to analyze' })
  @IsUUID()
  mappingId: string;

  @ApiPropertyOptional({ description: 'Framework to analyze (source/target)' })
  @IsString()
  @IsOptional()
  framework?: string;

  @ApiPropertyOptional({ description: 'Analyze bidirectional gaps' })
  @IsBoolean()
  @IsOptional()
  analyzeBidirectional?: boolean;
}
