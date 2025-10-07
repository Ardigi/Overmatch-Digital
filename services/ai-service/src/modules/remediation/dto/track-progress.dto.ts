import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class TrackProgressDto {
  @ApiProperty({ description: 'Remediation ID to track progress for' })
  @IsUUID()
  remediationId: string;

  @ApiPropertyOptional({ description: 'Include detailed metrics' })
  @IsBoolean()
  @IsOptional()
  includeMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Include completion forecast' })
  @IsBoolean()
  @IsOptional()
  includeForecast?: boolean;

  @ApiPropertyOptional({ description: 'Include historical trends' })
  @IsBoolean()
  @IsOptional()
  includeHistory?: boolean;
}
