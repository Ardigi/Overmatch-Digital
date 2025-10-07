import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface AuditEventData {
  auditId: string;
  auditName: string;
  auditType?: string;
  description?: string;
  status?: string;
  framework?: string;
  scope?: string;
  auditorId?: string;
  auditorEmail?: string;
  auditorName?: string;
  leadAuditorId?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  startDate?: Date;
  endDate?: Date;
  findingsCount?: number;
  findings?: AuditFinding[];
  riskLevel?: string;
  complianceScore?: number;
}

export interface AuditFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  controlId?: string;
  assigneeId?: string;
  dueDate?: Date;
}

@Injectable()
export class AuditEventHandler extends BaseEventHandler<AuditEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'audit';
  }

  extractEventData(payload: any): AuditEventData {
    return {
      auditId: payload.auditId || payload.id,
      auditName: payload.auditName || payload.name,
      auditType: payload.auditType || payload.type,
      description: payload.description,
      status: payload.status,
      framework: payload.framework || payload.complianceFramework,
      scope: payload.scope,
      auditorId: payload.auditorId || payload.auditor,
      auditorEmail: payload.auditorEmail,
      auditorName: payload.auditorName,
      leadAuditorId: payload.leadAuditorId || payload.leadAuditor,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      findingsCount: payload.findingsCount || payload.findings?.length || 0,
      findings: payload.findings || [],
      riskLevel: payload.riskLevel,
      complianceScore: payload.complianceScore,
    };
  }

  async evaluateNotificationRules(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'audit.created':
        decisions.push(...(await this.evaluateAuditCreated(data, context)));
        break;
      case 'audit.started':
        decisions.push(...(await this.evaluateAuditStarted(data, context)));
        break;
      case 'audit.completed':
        decisions.push(...(await this.evaluateAuditCompleted(data, context)));
        break;
      case 'audit.finding.created':
        decisions.push(...(await this.evaluateFindingCreated(data, context)));
        break;
      case 'audit.finding.resolved':
        decisions.push(...(await this.evaluateFindingResolved(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const auditorData = data.auditorId ? await this.userDataService.getUserById(data.auditorId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        auditName: data.auditName,
        auditType: data.auditType,
        auditFramework: data.framework,
        auditorName: auditorData?.name || data.auditorName || data.auditorEmail || 'Auditor',
        organizationName: orgData?.name || 'Your Organization',
        auditUrl: `${process.env.APP_URL}/audits/${data.auditId}`,
        startDate: data.startDate?.toLocaleDateString(),
        endDate: data.endDate?.toLocaleDateString(),
        findingsCount: data.findingsCount,
        complianceScore: data.complianceScore,
      },
    };
  }

  private async evaluateAuditCreated(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify lead auditor
    if (data.leadAuditorId) {
      const leadAuditor = await this.userDataService.getUserById(data.leadAuditorId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'AUDIT_CREATED_LEAD',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.leadAuditorId,
          email: leadAuditor?.email,
          name: leadAuditor?.name,
        }],
        variables: {
          auditScope: data.scope,
          preparationDeadline: this.calculatePreparationDeadline(data.startDate),
        },
      });
    }

    // Notify all stakeholders about upcoming audit
    const stakeholders = await this.getAuditStakeholders(data.auditId, data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_SCHEDULED',
      channel: NotificationChannel.EMAIL,
      priority: 'medium',
      recipients: stakeholders,
      variables: {
        auditSchedule: `${data.startDate?.toLocaleDateString()} - ${data.endDate?.toLocaleDateString()}`,
        preparationGuideUrl: `${process.env.APP_URL}/audits/${data.auditId}/preparation`,
      },
    });

    // Teams announcement
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.metadata?.teamsWebhookUrl) {
      decisions.push({
        shouldSend: true,
        templateCode: 'AUDIT_SCHEDULED_TEAMS',
        channel: NotificationChannel.TEAMS,
        priority: 'medium',
        recipients: [{
          id: 'teams',
          webhookUrl: orgSettings.metadata.teamsWebhookUrl,
        }],
        variables: {
          auditDetails: this.formatAuditDetails(data),
        },
      });
    }

    return decisions;
  }

  private async evaluateAuditStarted(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify all control owners
    const controlOwners = await this.getControlOwners(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_STARTED_CONTROL_OWNERS',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: controlOwners,
      variables: {
        actionRequired: 'Please ensure all evidence is up-to-date and accessible',
        evidencePortalUrl: `${process.env.APP_URL}/audits/${data.auditId}/evidence`,
      },
    });

    // In-app notification for all users
    const allUsers = await this.getOrganizationUsers(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_IN_PROGRESS_INAPP',
      channel: NotificationChannel.IN_APP,
      priority: 'medium',
      recipients: allUsers.map(user => ({
        id: user.id,
        userId: user.id,
      })),
      variables: {
        auditStatus: 'Audit is now in progress',
      },
    });

    // Slack notification for visibility
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.metadata?.slackChannelId) {
      decisions.push({
        shouldSend: true,
        templateCode: 'AUDIT_STARTED_SLACK',
        channel: NotificationChannel.SLACK,
        priority: 'medium',
        recipients: [{
          id: 'slack',
          channelId: orgSettings.metadata.slackChannelId,
        }],
        variables: {
          auditDashboardUrl: `${process.env.APP_URL}/audits/${data.auditId}/dashboard`,
        },
      });
    }

    return decisions;
  }

  private async evaluateAuditCompleted(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Executive summary to leadership
    const executives = await this.getExecutives(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_COMPLETED_EXECUTIVE',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: executives,
      variables: {
        auditSummary: this.generateAuditSummary(data),
        complianceScore: data.complianceScore,
        criticalFindings: this.getCriticalFindings(data.findings),
        reportUrl: `${process.env.APP_URL}/audits/${data.auditId}/report`,
      },
    });

    // Detailed report to compliance team
    const complianceTeam = await this.getComplianceTeam(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_COMPLETED_COMPLIANCE',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: complianceTeam,
      variables: {
        findingsBreakdown: this.getFindingsBreakdown(data.findings),
        remediationPlan: `${process.env.APP_URL}/audits/${data.auditId}/remediation`,
      },
    });

    // Notification to all stakeholders
    const stakeholders = await this.getAuditStakeholders(data.auditId, data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'AUDIT_COMPLETED_STAKEHOLDER',
      channel: NotificationChannel.EMAIL,
      priority: 'medium',
      recipients: stakeholders,
      variables: {
        overallResult: this.getOverallResult(data),
        nextSteps: 'Review findings and implement remediation plan',
      },
    });

    // Push notification for urgent findings
    if (this.hasUrgentFindings(data.findings)) {
      const controlOwners = await this.getControlOwners(data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'AUDIT_URGENT_FINDINGS_PUSH',
        channel: NotificationChannel.PUSH,
        priority: 'urgent',
        recipients: controlOwners.map(owner => ({
          id: owner.id,
          userId: owner.id,
        })),
        variables: {
          urgentCount: this.countUrgentFindings(data.findings),
        },
      });
    }

    return decisions;
  }

  private async evaluateFindingCreated(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];
    const finding = data.metadata?.finding || data.findings?.[0];

    if (!finding) return decisions;

    // Notify assignee if finding is assigned
    if (finding.assigneeId) {
      const assignee = await this.userDataService.getUserById(finding.assigneeId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'AUDIT_FINDING_ASSIGNED',
        channel: NotificationChannel.EMAIL,
        priority: this.getFindingPriority(finding.severity),
        recipients: [{
          id: finding.assigneeId,
          email: assignee?.email,
          name: assignee?.name,
        }],
        variables: {
          findingTitle: finding.title,
          findingSeverity: finding.severity,
          findingDueDate: finding.dueDate,
          findingUrl: `${process.env.APP_URL}/audits/${data.auditId}/findings/${finding.id}`,
        },
      });

      // SMS for critical findings
      if (finding.severity === 'critical') {
        const userPrefs = await this.getUserPreferences(finding.assigneeId);
        if (userPrefs?.enableSmsAlerts && userPrefs?.phone) {
          decisions.push({
            shouldSend: true,
            templateCode: 'CRITICAL_FINDING_SMS',
            channel: NotificationChannel.SMS,
            priority: 'urgent',
            recipients: [{
              id: finding.assigneeId,
              phone: userPrefs.phone,
            }],
            variables: {
              findingTitle: finding.title,
            },
          });
        }
      }
    }

    // Notify control owner if finding relates to a control
    if (finding.controlId) {
      const controlOwner = await this.getControlOwner(finding.controlId, data.organizationId);
      if (controlOwner) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_FINDING_CREATED',
          channel: NotificationChannel.IN_APP,
          priority: 'high',
          recipients: [{
            id: controlOwner.id,
            userId: controlOwner.id,
          }],
          variables: {
            controlId: finding.controlId,
            findingSeverity: finding.severity,
          },
        });
      }
    }

    // Alert compliance team for high/critical findings
    if (finding.severity === 'critical' || finding.severity === 'high') {
      const complianceTeam = await this.getComplianceTeam(data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'HIGH_SEVERITY_FINDING_ALERT',
        channel: NotificationChannel.SLACK,
        priority: 'urgent',
        recipients: complianceTeam,
        variables: {
          findingDetails: this.formatFindingDetails(finding),
          auditLink: `${process.env.APP_URL}/audits/${data.auditId}`,
        },
      });
    }

    return decisions;
  }

  private async evaluateFindingResolved(
    data: AuditEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];
    const finding = data.metadata?.finding || data.findings?.[0];

    if (!finding) return decisions;

    // Notify auditor of resolution
    if (data.auditorId) {
      const auditor = await this.userDataService.getUserById(data.auditorId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'FINDING_RESOLVED_AUDITOR',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.auditorId,
          email: auditor?.email,
          name: auditor?.name,
        }],
        variables: {
          findingTitle: finding.title,
          resolvedBy: data.metadata?.resolvedBy,
          resolutionDate: context.timestamp,
          resolutionDetails: data.metadata?.resolutionDetails,
        },
      });
    }

    // Update compliance dashboard
    const complianceTeam = await this.getComplianceTeam(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'FINDING_RESOLVED_COMPLIANCE',
      channel: NotificationChannel.IN_APP,
      priority: 'low',
      recipients: complianceTeam.map(member => ({
        id: member.id,
        userId: member.id,
      })),
      variables: {
        remainingFindings: data.metadata?.remainingFindings,
        complianceProgress: data.metadata?.complianceProgress,
      },
    });

    // Congratulate assignee who resolved the finding
    if (finding.assigneeId) {
      decisions.push({
        shouldSend: true,
        templateCode: 'FINDING_RESOLVED_ASSIGNEE',
        channel: NotificationChannel.IN_APP,
        priority: 'low',
        recipients: [{
          id: finding.assigneeId,
          userId: finding.assigneeId,
        }],
        variables: {
          findingTitle: finding.title,
        },
      });
    }

    return decisions;
  }

  private calculatePreparationDeadline(startDate?: Date): string {
    if (!startDate) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);
      return deadline.toISOString();
    }
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() - 7);
    return deadline.toISOString();
  }

  private formatAuditDetails(data: AuditEventData): string {
    return `${data.auditType} Audit - ${data.framework} Framework\nScope: ${data.scope}\nScheduled: ${data.startDate?.toLocaleDateString()} - ${data.endDate?.toLocaleDateString()}`;
  }

  private generateAuditSummary(data: AuditEventData): string {
    return `Audit completed with ${data.findingsCount} findings. Compliance score: ${data.complianceScore}%. Risk level: ${data.riskLevel || 'Medium'}`;
  }

  private getCriticalFindings(findings?: AuditFinding[]): number {
    if (!findings) return 0;
    return findings.filter(f => f.severity === 'critical').length;
  }

  private getFindingsBreakdown(findings?: AuditFinding[]): Record<string, number> {
    if (!findings) return {};
    return findings.reduce((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getOverallResult(data: AuditEventData): string {
    if (data.complianceScore >= 95) return 'Excellent - Fully Compliant';
    if (data.complianceScore >= 80) return 'Good - Minor Issues';
    if (data.complianceScore >= 60) return 'Fair - Improvements Needed';
    return 'Poor - Significant Remediation Required';
  }

  private hasUrgentFindings(findings?: AuditFinding[]): boolean {
    if (!findings) return false;
    return findings.some(f => f.severity === 'critical' || f.severity === 'high');
  }

  private countUrgentFindings(findings?: AuditFinding[]): number {
    if (!findings) return 0;
    return findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
  }

  private getFindingPriority(severity: string): string {
    switch (severity) {
      case 'critical': return 'urgent';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  private formatFindingDetails(finding: AuditFinding): string {
    return `${finding.title}\nSeverity: ${finding.severity}\nDue: ${finding.dueDate?.toLocaleDateString() || 'ASAP'}`;
  }

  private async getAuditStakeholders(auditId: string, organizationId: string): Promise<any[]> {
    // Would query for users involved in the audit
    return [];
  }

  private async getControlOwners(organizationId: string): Promise<any[]> {
    // Would query for all control owners in the organization
    return [];
  }

  private async getControlOwner(controlId: string, organizationId: string): Promise<any> {
    // Would query for specific control owner
    return null;
  }

  private async getExecutives(organizationId: string): Promise<any[]> {
    // Would query for executive team members
    return [];
  }

  private async getComplianceTeam(organizationId: string): Promise<any[]> {
    // Would query for compliance team members
    return [];
  }

  private async getOrganizationUsers(organizationId: string): Promise<any[]> {
    // Would query for all organization users
    return [];
  }
}