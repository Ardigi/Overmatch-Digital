import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuditType } from '../entities/soc-audit.entity';

export class CreateSOCAuditDto {
  @ApiProperty({ description: 'Unique audit number' })
  @IsString()
  auditNumber: string;

  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: AuditType, description: 'Type of SOC audit' })
  @IsEnum(AuditType)
  auditType: AuditType;

  @ApiProperty({ description: 'Audit period start date' })
  @IsDate()
  @Type(() => Date)
  auditPeriodStart: Date;

  @ApiProperty({ description: 'Audit period end date' })
  @IsDate()
  @Type(() => Date)
  auditPeriodEnd: Date;

  @ApiPropertyOptional({ description: 'Planned completion date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  plannedCompletionDate?: Date;

  @ApiProperty({
    description: 'Trust Services Criteria',
    example: ['SECURITY', 'AVAILABILITY'],
  })
  @IsArray()
  @IsString({ each: true })
  trustServiceCriteria: string[];

  @ApiProperty({ description: 'Lead auditor ID' })
  @IsUUID()
  leadAuditorId: string;

  @ApiProperty({ description: 'Engagement partner ID' })
  @IsUUID()
  engagementPartnerId: string;

  @ApiProperty({ description: 'Audit team member IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  auditTeamIds: string[];

  @ApiPropertyOptional({ description: 'Quality reviewer ID' })
  @IsOptional()
  @IsUUID()
  qualityReviewerId?: string;

  @ApiProperty({ description: 'CPA firm ID' })
  @IsUUID()
  cpaFirmId: string;

  @ApiProperty({ description: 'CPA firm name' })
  @IsString()
  cpaFirmName: string;

  @ApiPropertyOptional({ description: 'CPA engagement letter URL' })
  @IsOptional()
  @IsString()
  cpaEngagementLetter?: string;

  @ApiProperty({ description: 'Audit objectives' })
  @IsString()
  auditObjectives: string;

  @ApiProperty({ description: 'Scope description' })
  @IsString()
  scopeDescription: string;

  @ApiProperty({ description: 'In-scope services' })
  @IsArray()
  @IsString({ each: true })
  inScopeServices: string[];

  @ApiProperty({ description: 'In-scope locations' })
  @IsArray()
  @IsString({ each: true })
  inScopeLocations: string[];

  @ApiPropertyOptional({ description: 'Out-of-scope items' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outOfScopeItems?: string[];

  @ApiPropertyOptional({ description: 'Control framework ID' })
  @IsOptional()
  @IsUUID()
  controlFrameworkId?: string;

  @ApiPropertyOptional({ description: 'Risk factors' })
  @IsOptional()
  @IsObject()
  riskFactors?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report template ID' })
  @IsOptional()
  @IsUUID()
  reportTemplateId?: string;

  @ApiPropertyOptional({ description: 'Compliance requirements' })
  @IsOptional()
  @IsObject()
  complianceRequirements?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Regulatory frameworks' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regulatoryFrameworks?: string[];

  @ApiPropertyOptional({ description: 'Budgeted hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetedHours?: number;

  @ApiPropertyOptional({ description: 'Budgeted cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetedCost?: number;

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
