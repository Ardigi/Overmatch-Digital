import { ApiProperty } from '@nestjs/swagger';
import { AuditEntry } from '../entities/audit-entry.entity';

export class AuditReportSummaryDto {
  @ApiProperty()
  totalEntries: number;

  @ApiProperty()
  successfulEntries: number;

  @ApiProperty()
  failedEntries: number;

  @ApiProperty()
  anomalies: number;

  @ApiProperty()
  highRiskEntries: number;

  @ApiProperty()
  totalSessions: number;

  @ApiProperty()
  activeSessions: number;

  @ApiProperty()
  suspiciousSessions: number;
}

export class TopUserActivityDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  count: number;
}

export class RecentAnomalyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  user: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  resource: string;

  @ApiProperty()
  reason?: string;
}

export class AuditReportDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  summary: AuditReportSummaryDto;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  actionBreakdown: Record<string, number>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  resourceBreakdown: Record<string, number>;

  @ApiProperty({ type: [TopUserActivityDto] })
  topUsers: TopUserActivityDto[];

  @ApiProperty({ type: [RecentAnomalyDto] })
  recentAnomalies: RecentAnomalyDto[];

  @ApiProperty({ type: [AuditEntry] })
  requiresReview: AuditEntry[];
}
