import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartWorkflowDto {
  @ApiProperty({ description: 'Workflow input parameters' })
  @IsObject()
  inputs: Record<string, any>;

  @ApiPropertyOptional({ description: 'Workflow context metadata' })
  @IsObject()
  @IsOptional()
  context?: {
    clientId?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  };

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Execution priority (1-10)', minimum: 1, maximum: 10 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  priority?: number;

  // These will be set by the service
  userId?: string;
  organizationId?: string;
}
