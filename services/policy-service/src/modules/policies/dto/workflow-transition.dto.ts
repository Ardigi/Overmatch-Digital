import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { WorkflowState } from '../entities/policy.entity';
import type {
  WorkflowTransitionMetadata,
  WorkflowTransitionAttributes,
  WorkflowAdditionalContext,
} from '../../shared/types';

export class WorkflowTransitionDto {
  @ApiProperty({ enum: WorkflowState })
  @IsEnum(WorkflowState)
  targetState: WorkflowState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: WorkflowTransitionMetadata;
}

export class PolicyEvaluationContextDto {
  @ApiProperty()
  @IsObject()
  user: {
    id: string;
    roles: string[];
    department?: string;
    clearanceLevel?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  resource?: {
    type: string;
    id: string;
    attributes?: WorkflowTransitionAttributes;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  environment?: {
    time?: string;
    ipAddress?: string;
    location?: string;
    [key: string]: string | undefined;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalContext?: WorkflowAdditionalContext;
}
