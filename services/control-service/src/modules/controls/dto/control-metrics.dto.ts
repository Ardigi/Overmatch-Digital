import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsDateString, IsEnum, ValidateNested, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum MetricPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum MetricType {
  EFFECTIVENESS = 'EFFECTIVENESS',
  EFFICIENCY = 'EFFICIENCY',
  COVERAGE = 'COVERAGE',
  COMPLIANCE = 'COMPLIANCE',
  PERFORMANCE = 'PERFORMANCE',
}

export class MetricDataPointDto {
  @ApiProperty({ description: 'Data point timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value: number;

  @ApiProperty({ description: 'Data point label', required: false })
  @IsString()
  @IsOptional()
  label?: string;
}

export class ControlMetricDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Metric type', enum: MetricType })
  @IsEnum(MetricType)
  type: MetricType;

  @ApiProperty({ description: 'Current metric value' })
  @IsNumber()
  currentValue: number;

  @ApiProperty({ description: 'Target/baseline value', required: false })
  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @ApiProperty({ description: 'Previous period value for comparison', required: false })
  @IsNumber()
  @IsOptional()
  previousValue?: number;

  @ApiProperty({ description: 'Percentage change from previous period', required: false })
  @IsNumber()
  @IsOptional()
  changePercentage?: number;

  @ApiProperty({ description: 'Metric unit (%, count, hours, etc.)', required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ description: 'Time series data points', type: [MetricDataPointDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricDataPointDto)
  @IsOptional()
  timeSeries?: MetricDataPointDto[];
}

export class ControlMetricsDto {
  @ApiProperty({ description: 'Metrics reporting period', enum: MetricPeriod, required: false })
  @IsEnum(MetricPeriod)
  @IsOptional()
  period?: MetricPeriod;

  @ApiProperty({ description: 'Period start date', required: false })
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiProperty({ description: 'Period end date', required: false })
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ description: 'Overall success rate percentage (0-100)' })
  @IsNumber()
  successRate: number;

  @ApiProperty({ description: 'Average test duration in minutes', required: false })
  @IsNumber()
  @IsOptional()
  avgTestDuration?: number;

  @ApiProperty({ description: 'Total number of tests performed' })
  @IsNumber()
  totalTests: number;

  @ApiProperty({ description: 'Number of passed tests' })
  @IsNumber()
  passedTests: number;

  @ApiProperty({ description: 'Number of failed tests' })
  @IsNumber()
  failedTests: number;

  @ApiProperty({ description: 'Number of exceptions granted', required: false })
  @IsNumber()
  @IsOptional()
  exceptionCount?: number;

  @ApiProperty({ description: 'Date of last successful test', required: false })
  @IsDateString()
  @IsOptional()
  lastTestDate?: string;

  @ApiProperty({ description: 'Date of next scheduled test', required: false })
  @IsDateString()
  @IsOptional()
  nextTestDate?: string;

  @ApiProperty({ description: 'Control maturity score (1-5)', required: false })
  @IsNumber()
  @IsOptional()
  maturityScore?: number;

  @ApiProperty({ description: 'Implementation completeness percentage', required: false })
  @IsNumber()
  @IsOptional()
  implementationCompleteness?: number;

  @ApiProperty({ description: 'Automation coverage percentage', required: false })
  @IsNumber()
  @IsOptional()
  automationCoverage?: number;

  @ApiProperty({ description: 'Detailed metrics breakdown', type: [ControlMetricDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ControlMetricDto)
  @IsOptional()
  detailedMetrics?: ControlMetricDto[];

  @ApiProperty({ description: 'Mean time to resolution for issues (hours)', required: false })
  @IsNumber()
  @IsOptional()
  meanTimeToResolution?: number;

  @ApiProperty({ description: 'Cost of control testing', required: false })
  @IsNumber()
  @IsOptional()
  testingCost?: number;

  @ApiProperty({ description: 'Cost of control implementation', required: false })
  @IsNumber()
  @IsOptional()
  implementationCost?: number;
}
