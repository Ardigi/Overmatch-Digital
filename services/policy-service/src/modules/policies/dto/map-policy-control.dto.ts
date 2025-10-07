import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class MapPolicyToControlDto {
  @ApiProperty({ description: 'Control ID to map policy to' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Framework the control belongs to', example: 'SOC2' })
  @IsString()
  framework: string;

  @ApiProperty({
    description: 'How this policy implements the control',
    example:
      'This policy defines access control procedures that directly address CC6.1 requirements',
  })
  @IsString()
  implementation: string;

  @ApiProperty({
    description: 'Strength of the policy-control mapping',
    enum: ['strong', 'moderate', 'weak'],
    example: 'strong',
  })
  @IsEnum(['strong', 'moderate', 'weak'])
  strength: 'strong' | 'moderate' | 'weak';

  @ApiProperty({
    description: 'Additional notes about the mapping',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Any gaps in coverage',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  gaps?: string[];

  @ApiProperty({
    description: 'Evidence IDs that support this mapping',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  evidence?: string[];
}

export class BulkMapPolicyToControlsDto {
  @ApiProperty({
    description: 'Array of control IDs to map',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  controlIds: string[];

  @ApiProperty({ description: 'Framework the controls belong to' })
  @IsString()
  framework: string;

  @ApiProperty({
    description: 'Default implementation description',
    example: 'This policy addresses the requirements outlined in these controls',
  })
  @IsString()
  implementation: string;

  @ApiProperty({
    description: 'Default strength of mappings',
    enum: ['strong', 'moderate', 'weak'],
    example: 'moderate',
  })
  @IsEnum(['strong', 'moderate', 'weak'])
  strength: 'strong' | 'moderate' | 'weak';
}

export class UnmapPolicyFromControlDto {
  @ApiProperty({ description: 'Control ID to unmap from' })
  @IsUUID()
  controlId: string;

  @ApiProperty({
    description: 'Remove all framework references for this control',
    default: false,
  })
  @IsOptional()
  removeFromFramework?: boolean;
}

export class GetPoliciesByControlDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'Include archived policies',
    default: false,
    required: false,
  })
  @IsOptional()
  includeArchived?: boolean;

  @ApiProperty({
    description: 'Include retired policies',
    default: false,
    required: false,
  })
  @IsOptional()
  includeRetired?: boolean;

  @ApiProperty({
    description: 'Policy status filter',
    enum: ['draft', 'pending_review', 'approved', 'published', 'effective'],
    required: false,
  })
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Minimum mapping strength',
    enum: ['strong', 'moderate', 'weak'],
    required: false,
  })
  @IsOptional()
  minStrength?: 'strong' | 'moderate' | 'weak';
}

export class PolicyControlMappingDto {
  @ApiProperty({ description: 'Policy details' })
  policy: {
    id: string;
    title: string;
    policyNumber: string;
    type: string;
    status: string;
  };

  @ApiProperty({ description: 'Control details' })
  control: {
    id: string;
    code: string;
    name: string;
    framework: string;
  };

  @ApiProperty({ description: 'Mapping details' })
  mapping: {
    implementation: string;
    strength: 'strong' | 'moderate' | 'weak';
    notes?: string;
    gaps?: string[];
    evidence?: string[];
    lastUpdated: Date;
    mappedBy: string;
  };
}

export class UpdatePolicyControlMappingDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({
    description: 'Updated implementation description',
    required: false,
  })
  @IsString()
  @IsOptional()
  implementation?: string;

  @ApiProperty({
    description: 'Updated strength',
    enum: ['strong', 'moderate', 'weak'],
    required: false,
  })
  @IsEnum(['strong', 'moderate', 'weak'])
  @IsOptional()
  strength?: 'strong' | 'moderate' | 'weak';

  @ApiProperty({
    description: 'Updated notes',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Updated gaps',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  gaps?: string[];

  @ApiProperty({
    description: 'Updated evidence IDs',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  evidence?: string[];
}

export class PolicyFrameworkMappingDto {
  @ApiProperty({ description: 'Framework name' })
  @IsString()
  framework: string;

  @ApiProperty({
    description: 'Control IDs to map to this framework',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  controlIds: string[];

  @ApiProperty({
    description: 'Auto-detect gaps in framework coverage',
    default: true,
  })
  @IsOptional()
  detectGaps?: boolean;
}

export class PolicyControlCoverageDto {
  policyId: string;
  policyNumber: string;
  title: string;
  frameworks: Array<{
    name: string;
    totalControls: number;
    mappedControls: number;
    coverage: number;
    byStrength: {
      strong: number;
      moderate: number;
      weak: number;
    };
    gaps: string[];
  }>;
  overallCoverage: number;
  lastAssessment: Date;
}
