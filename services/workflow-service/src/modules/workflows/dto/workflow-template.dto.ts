import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Template category' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'Is template public', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @ApiProperty({ description: 'Template configuration' })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  config: {
    steps: Array<{
      name: string;
      type: string;
      order: number;
      config: Record<string, any>;
      nextStepId?: string;
      errorStepIds?: string[];
    }>;
    defaultInputs?: Record<string, any>;
    customizable?: string[];
    requiredInputs?: string[];
    validations?: Record<string, any>;
  };

  @ApiPropertyOptional({ description: 'Template tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Template icon' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Template metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // These will be set by the service
  organizationId?: string;
  createdBy?: string;
}

export class CreateFromTemplateDto {
  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Input parameters for template' })
  @IsObject()
  @IsOptional()
  inputs?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom configurations' })
  @IsObject()
  @IsOptional()
  customizations?: Record<string, any>;

  // These will be set by the service
  organizationId?: string;
  createdBy?: string;
}
