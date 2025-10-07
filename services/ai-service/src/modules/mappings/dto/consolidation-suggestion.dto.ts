import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConsolidationSuggestionDto {
  @ApiProperty({ description: 'Frameworks to consolidate' })
  @IsArray()
  @IsString({ each: true })
  frameworks: string[];

  @ApiPropertyOptional({ description: 'Client ID for context' })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Consolidation strategy' })
  @IsString()
  @IsOptional()
  consolidationStrategy?: string;
}
