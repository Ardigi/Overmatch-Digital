import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export enum WorkflowType {
  AUTOMATED = 'automated',
  MANUAL = 'manual',
  APPROVAL = 'approval',
  SCHEDULED = 'scheduled',
}

export enum TriggerType {
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  EVENT = 'event',
  API = 'api',
}

export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class TriggerWorkflowDto {
  @ApiProperty({
    description: 'Name of the workflow to trigger',
    example: 'Evidence Collection',
  })
  @IsString()
  workflowName: string;

  @ApiPropertyOptional({
    enum: WorkflowType,
    description: 'Type of workflow to create if not found',
    default: WorkflowType.AUTOMATED,
  })
  @IsEnum(WorkflowType)
  @IsOptional()
  workflowType?: WorkflowType;

  @ApiProperty({
    enum: TriggerType,
    description: 'Type of trigger',
  })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiProperty({
    description: 'Service that triggered the workflow',
    example: 'integration-service',
  })
  @IsString()
  sourceService: string;

  @ApiProperty({
    description: 'Organization ID',
  })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'Client ID',
  })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    description: 'Data to pass to the workflow',
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({
    enum: WorkflowPriority,
    description: 'Priority of the workflow execution',
    default: WorkflowPriority.NORMAL,
  })
  @IsEnum(WorkflowPriority)
  @IsOptional()
  priority?: WorkflowPriority;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TriggerWorkflowResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({
    description: 'Workflow trigger result',
    example: {
      workflowId: '123e4567-e89b-12d3-a456-426614174000',
      instanceId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'running',
      message: 'Workflow triggered successfully from integration-service',
    },
  })
  data: {
    workflowId: string;
    instanceId: string;
    status: string;
    message: string;
  };
}
