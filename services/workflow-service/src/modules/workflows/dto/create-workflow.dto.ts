import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateWorkflowStepDto {
  @ApiProperty({ description: 'Step name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Step description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Step type (user_task, approval, system_task, etc.)' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Step execution order', minimum: 1 })
  @IsNumber()
  @Min(1)
  order: number;

  @ApiPropertyOptional({ description: 'Step configuration' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Next step ID or name' })
  @IsString()
  @IsOptional()
  nextStepId?: string;

  @ApiPropertyOptional({ description: 'Error step IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  errorStepIds?: string[];

  @ApiPropertyOptional({ description: 'Retry configuration' })
  @IsObject()
  @IsOptional()
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };

  @ApiPropertyOptional({ description: 'Is step active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Workflow category' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'Is draft workflow', default: false })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean = false;

  @ApiPropertyOptional({ description: 'Is template workflow', default: false })
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean = false;

  @ApiPropertyOptional({ description: 'Maximum execution time in seconds' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxExecutionTime?: number;

  @ApiPropertyOptional({ description: 'Retry configuration' })
  @IsObject()
  @IsOptional()
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };

  @ApiPropertyOptional({ description: 'Workflow triggers' })
  @IsObject()
  @IsOptional()
  triggers?: {
    manual?: boolean;
    events?: string[];
    schedule?: string;
    webhook?: boolean;
  };

  @ApiPropertyOptional({ description: 'Workflow metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Workflow steps', type: [CreateWorkflowStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  @ArrayMinSize(0)
  steps: CreateWorkflowStepDto[];

  // These will be set by the service
  organizationId?: string;
  createdBy?: string;
  clientId?: string;
  status?: string;
}
