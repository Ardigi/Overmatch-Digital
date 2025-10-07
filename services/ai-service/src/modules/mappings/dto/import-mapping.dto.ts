import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ImportMappingDto {
  @ApiProperty({ description: 'Import format (csv/json/excel)' })
  @IsString()
  format: string;

  @ApiProperty({ description: 'File URL to import from' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ description: 'Validation mode (strict/lenient)' })
  @IsString()
  @IsOptional()
  validationMode?: string;
}
