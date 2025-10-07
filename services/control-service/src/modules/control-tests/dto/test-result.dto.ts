import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsArray, ValidateNested, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export enum TestResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PARTIAL = 'PARTIAL',
  SKIP = 'SKIP',
  ERROR = 'ERROR',
}

export enum ExceptionType {
  TECHNICAL = 'TECHNICAL',
  BUSINESS = 'BUSINESS',
  OPERATIONAL = 'OPERATIONAL',
  TIMING = 'TIMING',
}

export class TestStepDto {
  @ApiProperty({ description: 'Step number' })
  @IsNumber()
  stepNumber: number;

  @ApiProperty({ description: 'Step description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Step result', enum: TestResult })
  @IsEnum(TestResult)
  result: TestResult;

  @ApiProperty({ description: 'Evidence URLs', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidence?: string[];

  @ApiProperty({ description: 'Step notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Step completion timestamp', required: false })
  @IsDateString()
  @IsOptional()
  timestamp?: string;
}

export class TestExceptionDto {
  @ApiProperty({ description: 'Exception type', enum: ExceptionType })
  @IsEnum(ExceptionType)
  type: ExceptionType;

  @ApiProperty({ description: 'Exception description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Impact assessment' })
  @IsString()
  impact: string;

  @ApiProperty({ description: 'Whether exception is approved', required: false })
  @IsOptional()
  approved?: boolean;

  @ApiProperty({ description: 'Who approved the exception', required: false })
  @IsUUID()
  @IsOptional()
  approvedBy?: string;
}

export class TestResultDto {
  @ApiProperty({ description: 'Overall test result', enum: TestResult })
  @IsEnum(TestResult)
  overallResult: TestResult;

  @ApiProperty({ description: 'Test steps', type: [TestStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestStepDto)
  steps: TestStepDto[];

  @ApiProperty({ description: 'Test exceptions', type: [TestExceptionDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestExceptionDto)
  @IsOptional()
  exceptions?: TestExceptionDto[];

  @ApiProperty({ description: 'Test duration in milliseconds', required: false })
  @IsNumber()
  @IsOptional()
  durationMs?: number;

  @ApiProperty({ description: 'Additional test notes', required: false })
  @IsString()
  @IsOptional()
  testNotes?: string;

  @ApiProperty({ description: 'Tester ID' })
  @IsUUID()
  testerId: string;
}
