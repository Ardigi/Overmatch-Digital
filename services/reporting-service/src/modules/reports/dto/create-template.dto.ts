import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Report type this template is for' })
  @IsOptional()
  @IsString()
  reportType?: string;

  @ApiProperty({ description: 'Report type (alias for reportType)' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Default output format' })
  @IsString()
  format: string;

  @ApiPropertyOptional({ description: 'Template content (HTML/Handlebars)' })
  @IsOptional()
  @IsString()
  templateContent?: string;

  @ApiPropertyOptional({ description: 'Template configuration' })
  @IsOptional()
  @IsObject()
  configuration?: {
    pageSize?: string;
    orientation?: string;
    margins?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    fonts?: string[];
    watermark?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  };

  @ApiPropertyOptional({ description: 'Template parameters schema' })
  @IsOptional()
  @IsObject()
  parameters?: Record<
    string,
    {
      type: string;
      required?: boolean;
      default?: any;
      description?: string;
    }
  >;

  @ApiPropertyOptional({ description: 'Template sections' })
  @IsOptional()
  @IsArray()
  sections?: Array<{
    name: string;
    type: string;
    required?: boolean;
    template?: string;
    filters?: any;
  }>;

  @ApiPropertyOptional({ description: 'Template variables' })
  @IsOptional()
  @IsArray()
  variables?: string[];

  @ApiPropertyOptional({ description: 'Whether template is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
