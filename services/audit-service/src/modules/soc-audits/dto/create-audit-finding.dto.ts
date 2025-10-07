import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { FindingSeverity, FindingType } from '../entities/audit-finding.entity';

export class CreateAuditFindingDto {
  @ApiProperty({ description: 'Finding number' })
  @IsString()
  findingNumber: string;

  @ApiProperty({ description: 'Audit ID' })
  @IsUUID()
  auditId: string;

  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Control code' })
  @IsString()
  controlCode: string;

  @ApiProperty({ description: 'Control name' })
  @IsString()
  controlName: string;

  @ApiProperty({ enum: FindingType })
  @IsEnum(FindingType)
  findingType: FindingType;

  @ApiProperty({ enum: FindingSeverity })
  @IsEnum(FindingSeverity)
  severity: FindingSeverity;

  @ApiProperty({ description: 'Finding title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Finding description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Condition observed' })
  @IsString()
  condition: string;

  @ApiProperty({ description: 'Criteria used for evaluation' })
  @IsString()
  criteria: string;

  @ApiProperty({ description: 'Root cause of the finding' })
  @IsString()
  cause: string;

  @ApiProperty({ description: 'Effect or potential impact' })
  @IsString()
  effect: string;

  @ApiProperty({ description: 'Recommendation for remediation' })
  @IsString()
  recommendation: string;

  @ApiPropertyOptional({
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    description: 'Risk rating',
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskRating?: string;

  @ApiProperty({ description: 'Affected Trust Service Criteria' })
  @IsArray()
  @IsString({ each: true })
  affectedTrustServiceCriteria: string[];

  @ApiPropertyOptional({ description: 'Business impact description' })
  @IsOptional()
  @IsString()
  businessImpact?: string;

  @ApiPropertyOptional({ description: 'Is the finding systematic?' })
  @IsOptional()
  @IsBoolean()
  isSystematic?: boolean;

  @ApiPropertyOptional({ description: 'Is the finding pervasive?' })
  @IsOptional()
  @IsBoolean()
  isPervasive?: boolean;

  @ApiPropertyOptional({ description: 'Do compensating controls exist?' })
  @IsOptional()
  @IsBoolean()
  isCompensatingControlsExist?: boolean;

  @ApiPropertyOptional({ description: 'Target remediation date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  targetRemediationDate?: Date;

  @ApiPropertyOptional({ description: 'Remediation owner ID' })
  @IsOptional()
  @IsUUID()
  remediationOwner?: string;

  @ApiPropertyOptional({ description: 'Remediation plan' })
  @IsOptional()
  @IsString()
  remediationPlan?: string;

  @ApiPropertyOptional({ description: 'Evidence IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds?: string[];

  @ApiPropertyOptional({ description: 'Testing procedures performed' })
  @IsOptional()
  @IsString()
  testingProcedures?: string;

  @ApiPropertyOptional({ description: 'Testing date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  testingDate?: Date;

  @ApiPropertyOptional({ description: 'Tested by user ID' })
  @IsOptional()
  @IsUUID()
  testedBy?: string;

  @ApiPropertyOptional({ description: 'Sample size' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sampleSize?: number;

  @ApiPropertyOptional({ description: 'Number of exceptions found' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exceptionsFound?: number;

  @ApiPropertyOptional({ description: 'Related finding IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedFindingIds?: string[];

  @ApiPropertyOptional({ description: 'Root cause finding ID' })
  @IsOptional()
  @IsUUID()
  rootCauseFindingId?: string;

  @ApiPropertyOptional({ description: 'Is this a prior year finding?' })
  @IsOptional()
  @IsBoolean()
  isPriorYearFinding?: boolean;

  @ApiPropertyOptional({ description: 'Prior year finding ID' })
  @IsOptional()
  @IsUUID()
  priorYearFindingId?: string;

  @ApiPropertyOptional({ description: 'Assigned to user ID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Custom fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
