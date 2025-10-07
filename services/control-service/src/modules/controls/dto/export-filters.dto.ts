import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsArray, IsBoolean } from 'class-validator';
import { ControlStatus, ControlCategory, ControlType } from '../entities/control.entity';
import { Framework } from '@soc-compliance/contracts';
import { ImplementationStatus, Effectiveness } from '@soc-compliance/contracts';

export enum ExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  JSON = 'JSON',
  XML = 'XML',
}

export enum ReportType {
  CONTROL_INVENTORY = 'CONTROL_INVENTORY',
  COMPLIANCE_SUMMARY = 'COMPLIANCE_SUMMARY',
  GAP_ANALYSIS = 'GAP_ANALYSIS',
  CONTROL_TESTING = 'CONTROL_TESTING',
  EFFECTIVENESS_REPORT = 'EFFECTIVENESS_REPORT',
  IMPLEMENTATION_STATUS = 'IMPLEMENTATION_STATUS',
  AUDIT_READINESS = 'AUDIT_READINESS',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  DETAILED_FINDINGS = 'DETAILED_FINDINGS',
  EXECUTIVE_SUMMARY = 'EXECUTIVE_SUMMARY',
}

export enum GroupingOption {
  FRAMEWORK = 'FRAMEWORK',
  CATEGORY = 'CATEGORY',
  STATUS = 'STATUS',
  OWNER = 'OWNER',
  RISK_LEVEL = 'RISK_LEVEL',
  IMPLEMENTATION_STATUS = 'IMPLEMENTATION_STATUS',
  NONE = 'NONE',
}

export class ExportFiltersDto {
  @ApiProperty({ description: 'Report type to export', enum: ReportType })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({ description: 'Export format', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({ description: 'Organization ID for the export' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Report title', required: false })
  @IsString()
  @IsOptional()
  reportTitle?: string;

  @ApiProperty({ description: 'Report description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Report period start date', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ description: 'Report period end date', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ description: 'Specific frameworks to include', type: [String], enum: Framework, required: false })
  @IsArray()
  @IsEnum(Framework, { each: true })
  @IsOptional()
  frameworks?: Framework[];

  @ApiProperty({ description: 'Control categories to include', type: [String], enum: ControlCategory, required: false })
  @IsArray()
  @IsEnum(ControlCategory, { each: true })
  @IsOptional()
  categories?: ControlCategory[];

  @ApiProperty({ description: 'Control types to include', type: [String], enum: ControlType, required: false })
  @IsArray()
  @IsEnum(ControlType, { each: true })
  @IsOptional()
  controlTypes?: ControlType[];

  @ApiProperty({ description: 'Control statuses to include', type: [String], enum: ControlStatus, required: false })
  @IsArray()
  @IsEnum(ControlStatus, { each: true })
  @IsOptional()
  statuses?: ControlStatus[];

  @ApiProperty({ description: 'Implementation statuses to include', type: [String], enum: ImplementationStatus, required: false })
  @IsArray()
  @IsEnum(ImplementationStatus, { each: true })
  @IsOptional()
  implementationStatuses?: ImplementationStatus[];

  @ApiProperty({ description: 'Effectiveness levels to include', type: [String], enum: Effectiveness, required: false })
  @IsArray()
  @IsEnum(Effectiveness, { each: true })
  @IsOptional()
  effectivenessLevels?: Effectiveness[];

  @ApiProperty({ description: 'Specific control IDs to include', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  controlIds?: string[];

  @ApiProperty({ description: 'Control owners to include', type: [String], required: false })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  ownerIds?: string[];

  @ApiProperty({ description: 'Risk levels to include', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  riskLevels?: string[];

  @ApiProperty({ description: 'How to group the data in the report', enum: GroupingOption, required: false })
  @IsEnum(GroupingOption)
  @IsOptional()
  groupBy?: GroupingOption;

  @ApiProperty({ description: 'Include control details in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeControlDetails?: boolean;

  @ApiProperty({ description: 'Include test results in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeTestResults?: boolean;

  @ApiProperty({ description: 'Include evidence information in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeEvidence?: boolean;

  @ApiProperty({ description: 'Include findings in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeFindings?: boolean;

  @ApiProperty({ description: 'Include gap analysis in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeGaps?: boolean;

  @ApiProperty({ description: 'Include risk assessments in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeRiskAssessments?: boolean;

  @ApiProperty({ description: 'Include implementation history in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeHistory?: boolean;

  @ApiProperty({ description: 'Include metrics and KPIs in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeMetrics?: boolean;

  @ApiProperty({ description: 'Include automation details in export', required: false })
  @IsBoolean()
  @IsOptional()
  includeAutomation?: boolean;

  @ApiProperty({ description: 'Only include controls that have failed tests', required: false })
  @IsBoolean()
  @IsOptional()
  failedControlsOnly?: boolean;

  @ApiProperty({ description: 'Only include controls with open findings', required: false })
  @IsBoolean()
  @IsOptional()
  openFindingsOnly?: boolean;

  @ApiProperty({ description: 'Include executive summary section', required: false })
  @IsBoolean()
  @IsOptional()
  includeExecutiveSummary?: boolean;

  @ApiProperty({ description: 'Include detailed methodology section', required: false })
  @IsBoolean()
  @IsOptional()
  includeMethodology?: boolean;

  @ApiProperty({ description: 'Include recommendations section', required: false })
  @IsBoolean()
  @IsOptional()
  includeRecommendations?: boolean;

  @ApiProperty({ description: 'Custom fields to include in export', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  customFields?: string[];

  @ApiProperty({ description: 'Email addresses to send the export to', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emailRecipients?: string[];

  @ApiProperty({ description: 'Schedule the export for later', required: false })
  @IsDateString()
  @IsOptional()
  scheduleFor?: string;

  @ApiProperty({ description: 'Password protect the export file', required: false })
  @IsBoolean()
  @IsOptional()
  passwordProtected?: boolean;
}
