import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ValidateMappingDto {
  @ApiProperty({ description: 'Mapping ID to validate' })
  @IsUUID()
  mappingId: string;

  @ApiPropertyOptional({ description: 'Perform deep validation' })
  @IsBoolean()
  @IsOptional()
  deepValidation?: boolean;

  @ApiPropertyOptional({ description: 'Check against latest framework versions' })
  @IsBoolean()
  @IsOptional()
  checkLatestVersions?: boolean;

  @ApiPropertyOptional({ description: 'Validate with AI model' })
  @IsBoolean()
  @IsOptional()
  aiValidation?: boolean;
}
