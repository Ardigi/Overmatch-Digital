import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PauseWorkflowDto {
  @ApiPropertyOptional({ description: 'Reason for pausing' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class CancelWorkflowDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ArchiveWorkflowDto {
  @ApiPropertyOptional({ description: 'Reason for archiving' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class CloneWorkflowDto {
  @ApiProperty({ description: 'Name for cloned workflow' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Description for cloned workflow' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

export class SubmitApprovalDto {
  @ApiProperty({
    description: 'Approval decision',
    enum: ['approved', 'rejected'],
  })
  @IsEnum(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Comments for the decision' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comments?: string;

  @ApiPropertyOptional({ description: 'Additional form data' })
  @IsObject()
  @IsOptional()
  formData?: Record<string, any>;

  // This will be set by the service
  userId?: string;
}

export class RetryStepDto {
  @ApiPropertyOptional({ description: 'Reason for retry' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class SkipStepDto {
  @ApiProperty({ description: 'Reason for skipping' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class UpdateWorkflowStateDto {
  @ApiPropertyOptional({ description: 'Variables to update' })
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Outputs to update' })
  @IsObject()
  @IsOptional()
  outputs?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Metadata to update' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
