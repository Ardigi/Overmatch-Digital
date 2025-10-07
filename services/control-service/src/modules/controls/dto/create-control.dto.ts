import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ControlCategory, ControlFrequency, ControlType, AutomationLevel } from '../entities/control.entity';

export class CreateControlDto {
  @ApiProperty({ description: 'Control code (e.g., AC-1, CC-1.1)' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: 'Control name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Control description' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Control objective' })
  @IsNotEmpty()
  @IsString()
  objective: string;

  @ApiProperty({ description: 'Control requirements', required: false })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiProperty({ enum: ControlType, description: 'Type of control' })
  @IsEnum(ControlType)
  type: ControlType;

  @ApiProperty({ enum: ControlCategory, description: 'Control category' })
  @IsEnum(ControlCategory)
  category: ControlCategory;

  @ApiProperty({ enum: ControlFrequency, description: 'Testing frequency' })
  @IsEnum(ControlFrequency)
  @IsOptional()
  frequency?: ControlFrequency;

  @ApiProperty({ description: 'Applicable frameworks' })
  @IsArray()
  @IsOptional()
  frameworks?: Array<{
    name: string;
    section?: string;
    reference?: string;
    requirements?: string;
  }>;

  @ApiProperty({ description: 'Implementation guidance', required: false })
  @IsOptional()
  @IsString()
  implementationGuidance?: string;

  @ApiProperty({ description: 'Test procedures', required: false })
  @IsOptional()
  @IsArray()
  testProcedures?: string[];

  @ApiProperty({ description: 'Evidence requirements', required: false })
  @IsOptional()
  @IsArray()
  evidenceRequirements?: string[];

  @ApiProperty({ description: 'Automation capable', required: false })
  @IsOptional()
  @IsBoolean()
  automationCapable?: boolean;

  @ApiProperty({ description: 'Automation details', required: false })
  @IsOptional()
  @IsObject()
  automationDetails?: {
    tool?: string;
    schedule?: string;
    scriptId?: string;
    apiEndpoint?: string;
    integrationId?: string;
    parameters?: any;
  };

  @ApiProperty({ description: 'Related control codes', required: false })
  @IsOptional()
  @IsArray()
  relatedControls?: string[];

  @ApiProperty({ description: 'Compensating control codes', required: false })
  @IsOptional()
  @IsArray()
  compensatingControls?: string[];

  @ApiProperty({ description: 'Tags', required: false })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ description: 'Control owner ID', required: false })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({ description: 'Risk rating', required: false })
  @IsOptional()
  @IsString()
  riskRating?: string;

  @ApiProperty({ description: 'Cost of implementation', required: false })
  @IsOptional()
  @IsNumber()
  costOfImplementation?: number;

  @ApiProperty({ description: 'Cost of testing', required: false })
  @IsOptional()
  @IsNumber()
  costOfTesting?: number;

  @ApiProperty({ description: 'Regulatory requirement', required: false })
  @IsOptional()
  @IsBoolean()
  regulatoryRequirement?: boolean;

  @ApiProperty({ description: 'Data classification', required: false })
  @IsOptional()
  @IsString()
  dataClassification?: string;

  @ApiProperty({ description: 'Business processes', required: false })
  @IsOptional()
  @IsArray()
  businessProcesses?: string[];

  @ApiProperty({ description: 'System components', required: false })
  @IsOptional()
  @IsArray()
  systemComponents?: string[];

  @ApiProperty({ description: 'Risk factors' })
  @IsArray()
  @IsOptional()
  riskFactors?: Array<{
    riskId: string;
    riskName: string;
    mitigationLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;

  @ApiProperty({ description: 'Stakeholders' })
  @IsArray()
  @IsOptional()
  stakeholders?: Array<{
    userId: string;
    role: string;
    notifyOnFailure: boolean;
  }>;

  @ApiProperty({ description: 'Custom fields' })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiProperty({ description: 'Created by user ID', required: false })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiProperty({ description: 'Updated by user ID', required: false })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiProperty({ description: 'Control priority', required: false })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({ description: 'Control complexity level', required: false })
  @IsOptional()
  @IsEnum(['HIGH', 'MEDIUM', 'LOW', 'VERY_HIGH'])
  complexity?: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_HIGH';

  @ApiProperty({ enum: AutomationLevel, description: 'Automation level', required: false })
  @IsOptional()
  @IsEnum(AutomationLevel)
  automationLevel?: AutomationLevel;

  @ApiProperty({ description: 'Business justification', required: false })
  @IsOptional()
  @IsString()
  businessJustification?: string;
}
