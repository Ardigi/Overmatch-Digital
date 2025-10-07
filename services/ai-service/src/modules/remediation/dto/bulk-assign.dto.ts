import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class BulkAssignDto {
  @ApiProperty({ description: 'Remediation IDs to assign' })
  @IsArray()
  @IsUUID('4', { each: true })
  remediationIds: string[];

  @ApiProperty({ description: 'Assignee user ID' })
  @IsUUID()
  assigneeId: string;

  @ApiPropertyOptional({ description: 'Rebalance workload across team' })
  @IsBoolean()
  @IsOptional()
  rebalanceWorkload?: boolean;

  @ApiPropertyOptional({ description: 'Consider assignee capacity' })
  @IsBoolean()
  @IsOptional()
  considerCapacity?: boolean;

  @ApiPropertyOptional({ description: 'Due date for all assigned remediations' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Assignment notes' })
  @IsOptional()
  notes?: string;
}
