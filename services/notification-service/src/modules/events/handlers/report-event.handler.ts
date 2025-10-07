import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface ReportEventData {
  reportId: string;
  reportName: string;
  reportType?: string;
  description?: string;
  status?: string;
  format?: string;
  framework?: string;
  period?: string;
  generatorId?: string;
  generatorEmail?: string;
  requesterId?: string;
  requesterEmail?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  generatedAt?: Date;
  scheduledAt?: Date;
  recipients?: string[];
  fileSize?: number;
  downloadUrl?: string;
  errorMessage?: string;
  retryCount?: number;
}

@Injectable()
export class ReportEventHandler extends BaseEventHandler<ReportEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'report';
  }

  extractEventData(payload: any): ReportEventData {
    return {
      reportId: payload.reportId || payload.id,
      reportName: payload.reportName || payload.name,
      reportType: payload.reportType || payload.type,
      description: payload.description,
      status: payload.status,
      format: payload.format || 'PDF',
      framework: payload.framework || payload.complianceFramework,
      period: payload.period || payload.reportPeriod,
      generatorId: payload.generatorId || payload.generatedBy,
      generatorEmail: payload.generatorEmail,
      requesterId: payload.requesterId || payload.requestedBy,
      requesterEmail: payload.requesterEmail,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      generatedAt: payload.generatedAt ? new Date(payload.generatedAt) : undefined,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
      recipients: payload.recipients || [],
      fileSize: payload.fileSize,
      downloadUrl: payload.downloadUrl,
      errorMessage: payload.errorMessage,
      retryCount: payload.retryCount || 0,
    };
  }

  async evaluateNotificationRules(
    data: ReportEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'report.generated':
        decisions.push(...(await this.evaluateReportGenerated(data, context)));
        break;
      case 'report.scheduled':
        decisions.push(...(await this.evaluateReportScheduled(data, context)));
        break;
      case 'report.failed':
        decisions.push(...(await this.evaluateReportFailed(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: ReportEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const requesterData = data.requesterId ? await this.userDataService.getUserById(data.requesterId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        reportName: data.reportName,
        reportType: data.reportType,
        reportPeriod: data.period,
        reportFormat: data.format,
        requesterName: requesterData?.name || data.requesterEmail || 'Report Requester',
        organizationName: orgData?.name || 'Your Organization',
        reportUrl: data.downloadUrl || `${process.env.APP_URL}/reports/${data.reportId}`,
        fileSize: this.formatFileSize(data.fileSize),
        generatedAt: data.generatedAt?.toLocaleString(),
      },
    };
  }

  private async evaluateReportGenerated(
    data: ReportEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify requester
    if (data.requesterId || data.requesterEmail) {
      const requester = data.requesterId ? await this.userDataService.getUserById(data.requesterId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_READY',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.requesterId || 'unknown',
          email: requester?.email || data.requesterEmail,
          name: requester?.name,
        }],
        variables: {
          downloadUrl: data.downloadUrl,
          expirationTime: this.calculateExpirationTime(),
          reportSummary: data.metadata?.summary,
        },
      });

      // In-app notification for immediate access
      if (data.requesterId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'REPORT_READY_INAPP',
          channel: NotificationChannel.IN_APP,
          priority: 'high',
          recipients: [{
            id: data.requesterId,
            userId: data.requesterId,
          }],
          variables: {
            actionUrl: `/reports/${data.reportId}`,
          },
        });
      }
    }

    // Distribute to specified recipients
    if (data.recipients && data.recipients.length > 0) {
      const recipientUsers = await this.userDataService.getUsersByIds(data.recipients);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_DISTRIBUTED',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: recipientUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
        })),
        variables: {
          sharedBy: data.requesterId ? 
            (await this.userDataService.getUserById(data.requesterId))?.name :
            data.requesterEmail,
          downloadUrl: data.downloadUrl,
          reportDescription: data.description,
        },
      });
    }

    // Special handling for compliance reports
    if (this.isComplianceReport(data.reportType)) {
      const complianceTeam = await this.getComplianceTeam(data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'COMPLIANCE_REPORT_GENERATED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: complianceTeam,
        variables: {
          framework: data.framework,
          complianceStatus: data.metadata?.complianceStatus,
          actionItems: data.metadata?.actionItems,
        },
      });

      // Executive notification for quarterly/annual reports
      if (this.isExecutiveReport(data.period)) {
        const executives = await this.getExecutives(data.organizationId);
        
        decisions.push({
          shouldSend: true,
          templateCode: 'EXECUTIVE_REPORT_READY',
          channel: NotificationChannel.EMAIL,
          priority: 'high',
          recipients: executives,
          variables: {
            executiveSummary: data.metadata?.executiveSummary,
            keyMetrics: data.metadata?.keyMetrics,
            presentationUrl: `${process.env.APP_URL}/reports/${data.reportId}/presentation`,
          },
        });
      }
    }

    // Slack notification for team reports
    if (data.metadata?.notifyTeam) {
      const orgSettings = await this.getOrganizationSettings(data.organizationId);
      if (orgSettings?.metadata?.slackChannelId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'REPORT_GENERATED_SLACK',
          channel: NotificationChannel.SLACK,
          priority: 'low',
          recipients: [{
            id: 'slack',
            channelId: orgSettings.metadata.slackChannelId,
          }],
          variables: {
            reportLink: data.downloadUrl,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateReportScheduled(
    data: ReportEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Confirm scheduling to requester
    if (data.requesterId || data.requesterEmail) {
      const requester = data.requesterId ? await this.userDataService.getUserById(data.requesterId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_SCHEDULED_CONFIRMATION',
        channel: NotificationChannel.EMAIL,
        priority: 'low',
        recipients: [{
          id: data.requesterId || 'unknown',
          email: requester?.email || data.requesterEmail,
          name: requester?.name,
        }],
        variables: {
          scheduledTime: data.scheduledAt?.toLocaleString(),
          frequency: data.metadata?.frequency || 'One-time',
          cancelUrl: `${process.env.APP_URL}/reports/${data.reportId}/cancel`,
        },
      });
    }

    // Reminder notification before generation
    if (data.scheduledAt && this.shouldSendReminder(data.scheduledAt)) {
      const reminderTime = new Date(data.scheduledAt);
      reminderTime.setHours(reminderTime.getHours() - 1);

      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_GENERATION_REMINDER',
        channel: NotificationChannel.IN_APP,
        priority: 'low',
        recipients: [{
          id: data.requesterId || 'unknown',
          userId: data.requesterId,
        }],
        variables: {
          generationTime: data.scheduledAt.toLocaleTimeString(),
        },
        metadata: {
          scheduledFor: reminderTime,
        },
      });
    }

    return decisions;
  }

  private async evaluateReportFailed(
    data: ReportEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify requester of failure
    if (data.requesterId || data.requesterEmail) {
      const requester = data.requesterId ? await this.userDataService.getUserById(data.requesterId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_GENERATION_FAILED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.requesterId || 'unknown',
          email: requester?.email || data.requesterEmail,
          name: requester?.name,
        }],
        variables: {
          errorMessage: data.errorMessage || 'Report generation encountered an error',
          retryCount: data.retryCount,
          willRetry: data.retryCount < 3,
          supportUrl: `${process.env.APP_URL}/support`,
        },
      });

      // Push notification for critical reports
      if (this.isCriticalReport(data.reportType)) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CRITICAL_REPORT_FAILED_PUSH',
          channel: NotificationChannel.PUSH,
          priority: 'urgent',
          recipients: [{
            id: data.requesterId || 'unknown',
            userId: data.requesterId,
          }],
          variables: {
            reportName: data.reportName,
          },
        });
      }
    }

    // Alert IT team for repeated failures
    if (data.retryCount >= 2) {
      const itTeam = await this.getITTeam(data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'REPORT_GENERATION_ISSUE',
        channel: NotificationChannel.SLACK,
        priority: 'high',
        recipients: itTeam,
        variables: {
          reportId: data.reportId,
          errorDetails: data.errorMessage,
          diagnosticsUrl: `${process.env.APP_URL}/admin/reports/${data.reportId}/diagnostics`,
        },
      });
    }

    // Notify scheduled recipients of delay
    if (data.recipients && data.recipients.length > 0 && data.metadata?.wasScheduled) {
      const recipientUsers = await this.userDataService.getUsersByIds(data.recipients);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'SCHEDULED_REPORT_DELAYED',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: recipientUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
        })),
        variables: {
          reportName: data.reportName,
          expectedDelay: '2-4 hours',
          alternativeUrl: `${process.env.APP_URL}/reports/archive`,
        },
      });
    }

    return decisions;
  }

  private formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private calculateExpirationTime(): string {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 7); // 7 days default
    return expiration.toLocaleDateString();
  }

  private isComplianceReport(reportType?: string): boolean {
    const complianceTypes = ['soc2', 'soc1', 'iso27001', 'hipaa', 'gdpr', 'compliance', 'audit'];
    return complianceTypes.some(type => reportType?.toLowerCase().includes(type));
  }

  private isExecutiveReport(period?: string): boolean {
    const executivePeriods = ['quarterly', 'q1', 'q2', 'q3', 'q4', 'annual', 'yearly'];
    return executivePeriods.some(p => period?.toLowerCase().includes(p));
  }

  private isCriticalReport(reportType?: string): boolean {
    const criticalTypes = ['audit', 'compliance', 'security', 'incident', 'breach'];
    return criticalTypes.some(type => reportType?.toLowerCase().includes(type));
  }

  private shouldSendReminder(scheduledAt: Date): boolean {
    const hoursUntilGeneration = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilGeneration > 1 && hoursUntilGeneration < 24;
  }

  private async getComplianceTeam(organizationId: string): Promise<any[]> {
    // Would query for compliance team members
    return [];
  }

  private async getExecutives(organizationId: string): Promise<any[]> {
    // Would query for executive team members
    return [];
  }

  private async getITTeam(organizationId: string): Promise<any[]> {
    // Would query for IT team members
    return [];
  }
}