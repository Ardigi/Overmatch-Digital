import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { TestStatus } from '../entities/control-test.entity';
import { CreateControlTestDto } from './create-control-test.dto';

export class UpdateControlTestDto extends PartialType(CreateControlTestDto) {
  @ApiProperty({ enum: TestStatus, description: 'Test status', required: false })
  @IsEnum(TestStatus)
  @IsOptional()
  status?: TestStatus;

  @ApiProperty({ description: 'Tester ID', required: false })
  @IsUUID()
  @IsOptional()
  testerId?: string;

  @ApiProperty({ description: 'Test results', required: false })
  @IsObject()
  @IsOptional()
  testResults?: any;

  @ApiProperty({ description: 'Test notes', required: false })
  @IsString()
  @IsOptional()
  testNotes?: string;

  @ApiProperty({ description: 'Reviewer ID', required: false })
  @IsUUID()
  @IsOptional()
  reviewedBy?: string;

  @ApiProperty({ description: 'Review date', required: false })
  @IsOptional()
  reviewedAt?: Date;

  @ApiProperty({ description: 'Reviewer notes', required: false })
  @IsString()
  @IsOptional()
  reviewerNotes?: string;

  @ApiProperty({ description: 'Automation results', required: false })
  @IsObject()
  @IsOptional()
  automationResults?: any;

  @ApiProperty({ description: 'Test result', required: false })
  @IsString()
  @IsOptional()
  result?: string;

  @ApiProperty({ description: 'Test findings', required: false })
  @IsArray()
  @IsOptional()
  findings?: any[];

  @ApiProperty({ description: 'Executed by user ID', required: false })
  @IsUUID()
  @IsOptional()
  executedBy?: string;

  @ApiProperty({ description: 'Execution date', required: false })
  @IsOptional()
  executionDate?: Date;
}
