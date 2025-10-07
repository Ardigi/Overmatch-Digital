import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AutoMapDto {
  @ApiProperty({ description: 'Source framework' })
  @IsString()
  sourceFramework: string;

  @ApiProperty({ description: 'Target framework' })
  @IsString()
  targetFramework: string;

  @ApiPropertyOptional({ description: 'Mapping mode (conservative/aggressive)' })
  @IsString()
  @IsOptional()
  mappingMode?: string;

  @ApiPropertyOptional({ description: 'Minimum similarity threshold' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  minSimilarity?: number;
}
