import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import type { BulkOperationParams } from '../../shared/types';

export enum BulkAction {
  APPROVE = 'approve',
  PUBLISH = 'publish',
  ARCHIVE = 'archive',
  UPDATE_STATUS = 'updateStatus',
  ASSIGN_OWNER = 'assignOwner',
  ADD_TAG = 'addTag',
  REMOVE_TAG = 'removeTag',
  UPDATE_COMPLIANCE_MAPPING = 'updateComplianceMapping',
}

export class BulkOperationDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  policyIds: string[];

  @ApiProperty({ enum: BulkAction })
  @IsEnum(BulkAction)
  action: BulkAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: BulkOperationParams;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkOperationResultDto {
  @ApiProperty({ type: [String] })
  success: string[];

  @ApiProperty()
  failed: Array<{
    id: string;
    error: string;
  }>;

  @ApiProperty()
  total: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failedCount: number;
}
