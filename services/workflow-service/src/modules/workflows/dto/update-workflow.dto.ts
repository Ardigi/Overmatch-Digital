import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateWorkflowDto, CreateWorkflowStepDto } from './create-workflow.dto';

export class UpdateWorkflowStepDto extends PartialType(CreateWorkflowStepDto) {
  @IsString()
  @IsOptional()
  id?: string; // For updating existing steps
}

export class UpdateWorkflowDto extends PartialType(
  OmitType(CreateWorkflowDto, ['organizationId', 'createdBy', 'steps'] as const)
) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWorkflowStepDto)
  @IsOptional()
  steps?: UpdateWorkflowStepDto[];

  // This will be set by the service
  modifiedBy?: string;
}
