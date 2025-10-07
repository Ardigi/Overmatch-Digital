import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean, IsDateString, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationLevel } from '../entities/control.entity';

export enum AutomationType {
  API = 'API',
  SCRIPT = 'SCRIPT',
  WEBHOOK = 'WEBHOOK',
  INTEGRATION = 'INTEGRATION',
  SCHEDULED_TASK = 'SCHEDULED_TASK',
}

export class AutomationParametersDto {
  @ApiProperty({ description: 'API endpoint URL', required: false })
  @IsString()
  @IsOptional()
  apiUrl?: string;

  @ApiProperty({ description: 'Authentication token', required: false })
  @IsString()
  @IsOptional()
  authToken?: string;

  @ApiProperty({ description: 'Request headers', required: false })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Request payload', required: false })
  @IsObject()
  @IsOptional()
  payload?: any;

  @ApiProperty({ description: 'Custom parameters', required: false })
  @IsObject()
  @IsOptional()
  customParams?: any;
}

export class AutomationDetailsDto {
  @ApiProperty({ description: 'Automation level', enum: AutomationLevel })
  @IsEnum(AutomationLevel)
  automationLevel: AutomationLevel;

  @ApiProperty({ description: 'Whether control is automation capable' })
  @IsBoolean()
  automationCapable: boolean;

  @ApiProperty({ description: 'Whether automation is implemented' })
  @IsBoolean()
  automationImplemented: boolean;

  @ApiProperty({ description: 'Automation type', enum: AutomationType, required: false })
  @IsEnum(AutomationType)
  @IsOptional()
  automationType?: AutomationType;

  @ApiProperty({ description: 'Automation tool name', required: false })
  @IsString()
  @IsOptional()
  tool?: string;

  @ApiProperty({ description: 'Execution schedule (cron format)', required: false })
  @IsString()
  @IsOptional()
  schedule?: string;

  @ApiProperty({ description: 'Script ID for automation', required: false })
  @IsString()
  @IsOptional()
  scriptId?: string;

  @ApiProperty({ description: 'API endpoint for automation', required: false })
  @IsString()
  @IsOptional()
  apiEndpoint?: string;

  @ApiProperty({ description: 'Integration ID', required: false })
  @IsString()
  @IsOptional()
  integrationId?: string;

  @ApiProperty({ description: 'Last automation run timestamp', required: false })
  @IsDateString()
  @IsOptional()
  lastRun?: string;

  @ApiProperty({ description: 'Automation parameters', type: AutomationParametersDto, required: false })
  @ValidateNested()
  @Type(() => AutomationParametersDto)
  @IsOptional()
  parameters?: AutomationParametersDto;

  @ApiProperty({ description: 'Automation configuration notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
