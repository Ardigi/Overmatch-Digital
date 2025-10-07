import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum AutomationRunStatus {
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

export enum AutomationTrigger {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  EVENT_DRIVEN = 'EVENT_DRIVEN',
  API_CALL = 'API_CALL',
}

export class AutomationLogDto {
  @ApiProperty({ description: 'Log level (INFO, WARN, ERROR, DEBUG)' })
  @IsString()
  level: string;

  @ApiProperty({ description: 'Log message' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Log timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Additional log context', required: false })
  @IsObject()
  @IsOptional()
  context?: any;
}

export class AutomationMetricDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value: number;

  @ApiProperty({ description: 'Metric unit', required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ description: 'Metric description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AutomationRunDto {
  @ApiProperty({ description: 'Automation run ID', required: false })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Control ID being automated' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Run status', enum: AutomationRunStatus })
  @IsEnum(AutomationRunStatus)
  status: AutomationRunStatus;

  @ApiProperty({ description: 'How the automation was triggered', enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  trigger: AutomationTrigger;

  @ApiProperty({ description: 'User ID who triggered the run', required: false })
  @IsUUID()
  @IsOptional()
  triggeredBy?: string;

  @ApiProperty({ description: 'Run start timestamp' })
  @IsDateString()
  startedAt: string;

  @ApiProperty({ description: 'Run completion timestamp', required: false })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiProperty({ description: 'Run duration in milliseconds', required: false })
  @IsNumber()
  @IsOptional()
  durationMs?: number;

  @ApiProperty({ description: 'Script or automation tool used', required: false })
  @IsString()
  @IsOptional()
  automationTool?: string;

  @ApiProperty({ description: 'Script ID or identifier', required: false })
  @IsString()
  @IsOptional()
  scriptId?: string;

  @ApiProperty({ description: 'Version of the automation script', required: false })
  @IsString()
  @IsOptional()
  scriptVersion?: string;

  @ApiProperty({ description: 'Input parameters for the automation', required: false })
  @IsObject()
  @IsOptional()
  inputParameters?: any;

  @ApiProperty({ description: 'Automation output/results', required: false })
  @IsObject()
  @IsOptional()
  output?: any;

  @ApiProperty({ description: 'Error message if run failed', required: false })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiProperty({ description: 'Error details/stack trace', required: false })
  @IsString()
  @IsOptional()
  errorDetails?: string;

  @ApiProperty({ description: 'Automation logs', type: [AutomationLogDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationLogDto)
  @IsOptional()
  logs?: AutomationLogDto[];

  @ApiProperty({ description: 'Performance metrics', type: [AutomationMetricDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationMetricDto)
  @IsOptional()
  metrics?: AutomationMetricDto[];

  @ApiProperty({ description: 'CPU usage percentage during run', required: false })
  @IsNumber()
  @IsOptional()
  cpuUsage?: number;

  @ApiProperty({ description: 'Memory usage in MB during run', required: false })
  @IsNumber()
  @IsOptional()
  memoryUsage?: number;

  @ApiProperty({ description: 'Network latency in ms', required: false })
  @IsNumber()
  @IsOptional()
  networkLatency?: number;

  @ApiProperty({ description: 'Evidence collected during automation', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  evidenceIds?: string[];

  @ApiProperty({ description: 'Next scheduled run time', required: false })
  @IsDateString()
  @IsOptional()
  nextScheduledRun?: string;
}
