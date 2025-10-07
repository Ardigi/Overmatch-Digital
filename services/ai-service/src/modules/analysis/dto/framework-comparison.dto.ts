import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class FrameworkComparisonDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Frameworks to compare' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  frameworks?: string[];

  @ApiPropertyOptional({ description: 'Current framework (for migration analysis)' })
  @IsString()
  @IsOptional()
  currentFramework?: string;

  @ApiPropertyOptional({ description: 'Target frameworks for migration' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetFrameworks?: string[];

  @ApiPropertyOptional({ description: 'Include control mapping' })
  @IsBoolean()
  @IsOptional()
  includeMapping?: boolean;

  @ApiPropertyOptional({ description: 'Include migration analysis' })
  @IsBoolean()
  @IsOptional()
  migrationAnalysis?: boolean;
}
