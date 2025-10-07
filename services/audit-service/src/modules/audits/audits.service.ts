import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { AuditPhase, AuditStatus, type SOCAudit } from '../soc-audits/entities/soc-audit.entity';
import type { SOCAuditsService } from '../soc-audits/soc-audits.service';
import type { AuditIntegrationService } from './audit-integration.service';
import type {
  ControlAssessment,
  EvidenceItem,
  ReportData,
  AuditLogEntry,
} from './interfaces/external-responses.interface';

@Injectable()
export class AuditsService {
  private readonly logger = new Logger(AuditsService.name);

  constructor(
    private readonly socAuditsService: SOCAuditsService,
    private readonly serviceDiscovery: ServiceDiscoveryService,
    private readonly auditIntegration: AuditIntegrationService
  ) {}

  /**
   * Get enriched audit data with control assessments from control-service
   */
  async getAuditWithControlAssessments(auditId: string): Promise<{
    audit: SOCAudit;
    controlAssessments: any[];
    controlTestingProgress: {
      total: number;
      tested: number;
      effective: number;
      deficient: number;
      percentage: number;
    };
  }> {
    try {
      // Get base audit data
      const audit = await this.socAuditsService.findOne(auditId);

      // Fetch control assessments from control-service
      const controlAssessments = await this.serviceDiscovery.callService(
        'control-service',
        'GET',
        `/controls/assessments?auditId=${auditId}`
      );

      // Calculate control testing progress
      const assessments = (controlAssessments.data as ControlAssessment[]) || [];
      const controlTestingProgress = {
        total: assessments.length,
        tested: assessments.filter((a) => a.status === 'tested').length,
        effective: assessments.filter((a) => a.effectiveness === 'effective').length,
        deficient: assessments.filter((a) => a.effectiveness === 'deficient').length,
        percentage:
          assessments.length > 0
            ? (assessments.filter((a) => a.status === 'tested').length / assessments.length) *
              100
            : 0,
      };

      // Update audit metrics
      await this.updateAuditControlMetrics(auditId, controlTestingProgress);

      return {
        audit,
        controlAssessments: assessments,
        controlTestingProgress,
      };
    } catch (error) {
      this.logger.error('Failed to get audit with control assessments', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve control assessment data');
    }
  }

  /**
   * Get audit evidence from evidence-service
   */
  async getAuditEvidence(
    auditId: string,
    params?: {
      controlId?: string;
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    evidence: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      const queryParams = new URLSearchParams({
        auditId,
        ...(params?.controlId && { controlId: params.controlId }),
        ...(params?.status && { status: params.status }),
        ...(params?.type && { type: params.type }),
        page: (params?.page || 1).toString(),
        limit: (params?.limit || 20).toString(),
      });

      const evidenceResponse = await this.serviceDiscovery.callService(
        'evidence-service',
        'GET',
        `/evidence?${queryParams.toString()}`
      );

      const evidenceData = (evidenceResponse.data as EvidenceItem[]) || [];
      const evidenceMeta = {
        total: evidenceData.length,
        page: params?.page || 1,
        limit: params?.limit || 20,
        totalPages: Math.ceil(evidenceData.length / (params?.limit || 20)),
      };

      return {
        evidence: evidenceData,
        meta: evidenceMeta,
      };
    } catch (error) {
      this.logger.error('Failed to get audit evidence', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve evidence data');
    }
  }

  /**
   * Upload evidence through evidence-service
   */
  async uploadAuditEvidence(
    auditId: string,
    evidenceData: {
      name: string;
      description?: string;
      controlId?: string;
      type: string;
      fileUrl?: string;
      metadata?: any;
    },
    userId: string
  ): Promise<any> {
    try {
      const uploadPayload = {
        ...evidenceData,
        auditId,
        uploadedBy: userId,
        uploadedAt: new Date(),
      };

      const evidenceResponse = await this.serviceDiscovery.callService(
        'evidence-service',
        'POST',
        '/evidence',
        uploadPayload
      );

      const uploadedEvidence = evidenceResponse.data as EvidenceItem;

      // Notify audit service about new evidence
      await this.sendAuditNotification(auditId, 'evidence_uploaded', {
        evidenceId: uploadedEvidence.id,
        evidenceName: evidenceData.name,
        uploadedBy: userId,
      });

      return evidenceResponse.data as EvidenceItem;
    } catch (error) {
      this.logger.error('Failed to upload audit evidence', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to upload evidence');
    }
  }

  /**
   * Get client information from client-service
   */
  async getAuditClientInfo(auditId: string): Promise<{
    audit: SOCAudit;
    client: any;
    organization: any;
  }> {
    try {
      const audit = await this.socAuditsService.findOne(auditId);

      // Get client information
      const clientResponse = await this.serviceDiscovery.callService(
        'client-service',
        'GET',
        `/clients/${audit.clientId}`
      );

      // Get organization information
      const organizationResponse = await this.serviceDiscovery.callService(
        'client-service',
        'GET',
        `/organizations/${audit.organizationId}`
      );

      return {
        audit,
        client: clientResponse.data,
        organization: organizationResponse.data,
      };
    } catch (error) {
      this.logger.error('Failed to get client information for audit', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve client information');
    }
  }

  /**
   * Generate audit report through reporting-service
   */
  async generateAuditReport(
    auditId: string,
    reportRequest: {
      format: 'pdf' | 'docx' | 'html';
      sections?: string[];
      includeEvidence?: boolean;
      includeFindings?: boolean;
      customTemplate?: string;
    },
    userId: string
  ): Promise<{
    reportId: string;
    status: string;
    estimatedCompletion: Date;
  }> {
    try {
      const audit = await this.socAuditsService.findOne(auditId);

      // Get audit metrics for report generation
      const metrics = await this.socAuditsService.getAuditMetrics(auditId);

      // Get control assessments and evidence for report
      const { controlAssessments } = await this.getAuditWithControlAssessments(auditId);
      const { evidence } = await this.getAuditEvidence(auditId);

      const reportPayload = {
        auditId,
        audit: {
          id: audit.id,
          auditNumber: audit.auditNumber,
          clientId: audit.clientId,
          organizationId: audit.organizationId,
          auditType: audit.auditType,
          auditPeriodStart: audit.auditPeriodStart,
          auditPeriodEnd: audit.auditPeriodEnd,
          status: audit.status,
          currentPhase: audit.currentPhase,
        },
        metrics,
        controlAssessments,
        evidence: reportRequest.includeEvidence ? evidence : [],
        reportRequest: {
          ...reportRequest,
          requestedBy: userId,
          requestedAt: new Date(),
        },
      };

      const reportResponse = await this.serviceDiscovery.callService(
        'reporting-service',
        'POST',
        '/reports/audit',
        reportPayload
      );

      const reportData = reportResponse.data as ReportData;

      // Send notification about report generation
      await this.sendAuditNotification(auditId, 'report_generation_started', {
        reportId: reportData.reportId,
        format: reportRequest.format,
        requestedBy: userId,
      });

      return {
        reportId: reportData.reportId,
        status: reportData.status,
        estimatedCompletion: reportData.estimatedCompletion,
      };
    } catch (error) {
      this.logger.error('Failed to generate audit report', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to generate audit report');
    }
  }

  /**
   * Get audit report status and download link
   */
  async getAuditReportStatus(
    auditId: string,
    reportId: string
  ): Promise<{
    reportId: string;
    status: string;
    progress: number;
    downloadUrl?: string;
    generatedAt?: Date;
    error?: string;
  }> {
    try {
      const reportResponse = await this.serviceDiscovery.callService(
        'reporting-service',
        'GET',
        `/reports/${reportId}`
      );

      const reportData = reportResponse.data as ReportData;
      return {
        reportId: reportData.id,
        status: reportData.status,
        progress: reportData.progress || 0,
        downloadUrl: reportData.downloadUrl,
        generatedAt: reportData.generatedAt,
        error: reportData.error,
      };
    } catch (error) {
      this.logger.error('Failed to get audit report status', {
        auditId,
        reportId,
        error: error.message,
      });
      throw new BadRequestException('Failed to get report status');
    }
  }

  /**
   * Send audit notification through notification-service
   */
  async sendAuditNotification(auditId: string, type: string, data: any): Promise<void> {
    try {
      const audit = await this.socAuditsService.findOne(auditId);

      const notificationPayload = {
        organizationId: audit.organizationId,
        type: `audit.${type}`,
        title: this.getNotificationTitle(type),
        message: this.getNotificationMessage(type, data),
        data: {
          auditId,
          auditNumber: audit.auditNumber,
          ...data,
        },
        recipients: [audit.leadAuditorId, audit.engagementPartnerId, ...audit.auditTeamIds],
        priority: this.getNotificationPriority(type),
        channels: ['email', 'in_app'],
      };

      await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/notifications',
        notificationPayload
      );
    } catch (error) {
      this.logger.error('Failed to send audit notification', {
        auditId,
        type,
        error: error.message,
      });
      // Don't throw error for notification failures
    }
  }

  /**
   * Update audit status with integrated service calls
   */
  async updateAuditStatusWithIntegration(
    auditId: string,
    status: AuditStatus,
    userId: string,
    comment?: string
  ): Promise<SOCAudit> {
    try {
      // Update the audit status
      const updatedAudit = await this.socAuditsService.updateStatus(auditId, status, userId);

      // Send notifications based on status change
      await this.sendAuditNotification(auditId, 'status_changed', {
        newStatus: status,
        comment,
        changedBy: userId,
      });

      // If audit is completed, trigger final report generation and sync
      if (status === AuditStatus.COMPLETED) {
        await this.generateAuditReport(
          auditId,
          {
            format: 'pdf',
            sections: ['summary', 'findings', 'recommendations'],
            includeEvidence: true,
            includeFindings: true,
          },
          userId
        );

        // Sync with external compliance systems
        await this.auditIntegration.syncWithComplianceSystems(auditId);
      }

      return updatedAudit;
    } catch (error) {
      this.logger.error('Failed to update audit status with integration', {
        auditId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get comprehensive audit dashboard data
   */
  async getAuditDashboard(auditId: string): Promise<{
    audit: SOCAudit;
    client: any;
    organization: any;
    controlAssessments: any[];
    controlTestingProgress: any;
    evidenceSummary: {
      total: number;
      byType: Record<string, number>;
      recentUploads: any[];
    };
    metrics: any;
    recentActivity: any[];
    notifications: any[];
  }> {
    try {
      // Get all audit data in parallel
      const [
        { audit, client, organization },
        { controlAssessments, controlTestingProgress },
        evidenceResult,
        metrics,
      ] = await Promise.all([
        this.getAuditClientInfo(auditId),
        this.getAuditWithControlAssessments(auditId),
        this.getAuditEvidence(auditId, { limit: 10 }),
        this.socAuditsService.getAuditMetrics(auditId),
      ]);

      const { evidence } = evidenceResult;

      // Calculate evidence summary
      const evidenceSummary = {
        total: evidence.length,
        byType: evidence.reduce((acc: Record<string, number>, e: any) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {}),
        recentUploads: evidence.slice(0, 5),
      };

      // Get recent notifications
      const notifications = await this.getAuditNotifications(auditId);

      return {
        audit,
        client,
        organization,
        controlAssessments,
        controlTestingProgress,
        evidenceSummary,
        metrics,
        recentActivity: await this.getRecentActivity(auditId)
        notifications: notifications.slice(0, 10),
      };
    } catch (error) {
      this.logger.error('Failed to get audit dashboard data', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve audit dashboard data');
    }
  }

  private async updateAuditControlMetrics(
    auditId: string,
    controlTestingProgress: any
  ): Promise<void> {
    try {
      await this.socAuditsService.update(
        auditId,
        {
          totalControls: controlTestingProgress.total,
          testedControls: controlTestingProgress.tested,
          effectiveControls: controlTestingProgress.effective,
          deficientControls: controlTestingProgress.deficient,
        },
        'system'
      );
    } catch (error) {
      this.logger.error('Failed to update audit control metrics', {
        auditId,
        error: error.message,
      });
    }
  }

  private async getAuditNotifications(auditId: string): Promise<any[]> {
    try {
      const notificationsResponse = await this.serviceDiscovery.callService(
        'notification-service',
        'GET',
        `/notifications?type=audit&auditId=${auditId}&limit=10`
      );
      const notifications = notificationsResponse.data || [];
      return notifications;
    } catch (error) {
      this.logger.error('Failed to get audit notifications', {
        auditId,
        error: error.message,
      });
      return [];
    }
  }

  private getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      status_changed: 'Audit Status Updated',
      evidence_uploaded: 'New Evidence Uploaded',
      report_generation_started: 'Report Generation Started',
      report_completed: 'Report Generation Completed',
      phase_changed: 'Audit Phase Updated',
    };
    return titles[type] || 'Audit Update';
  }

  private getNotificationMessage(type: string, data: any): string {
    const messages: Record<string, (data: any) => string> = {
      status_changed: (d) =>
        `Audit status changed to ${d.newStatus}${d.comment ? ': ' + d.comment : ''}`,
      evidence_uploaded: (d) => `New evidence "${d.evidenceName}" uploaded by ${d.uploadedBy}`,
      report_generation_started: (d) => `${d.format.toUpperCase()} report generation started`,
      report_completed: (d) => `${d.format.toUpperCase()} report is ready for download`,
      phase_changed: (d) => `Audit phase changed to ${d.newPhase}`,
    };
    return messages[type]?.(data) || 'Audit updated';
  }

  private getNotificationPriority(type: string): 'low' | 'medium' | 'high' {
    const priorities: Record<string, 'low' | 'medium' | 'high'> = {
      status_changed: 'medium',
      evidence_uploaded: 'low',
      report_generation_started: 'medium',
      report_completed: 'high',
      phase_changed: 'medium',
    };
    return priorities[type] || 'low';
  }

  /**
   * Get audit integration tracking logs
   */
  async getAuditIntegrationLogs(
    auditId: string,
    params?: {
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    logs: any[];
    summary: {
      totalActivities: number;
      controlActivities: number;
      evidenceActivities: number;
      reportActivities: number;
      clientDataAccess: number;
    };
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      // This would call the audit trail service to get audit-specific logs
      const queryParams = new URLSearchParams({
        auditId,
        ...(params?.action && { action: params.action }),
        ...(params?.resource && { resource: params.resource }),
        ...(params?.startDate && { startDate: params.startDate.toISOString() }),
        ...(params?.endDate && { endDate: params.endDate.toISOString() }),
        page: (params?.page || 1).toString(),
        limit: (params?.limit || 20).toString(),
      });

      // Get audit trail entries for this audit
      const auditTrailResponse = await this.serviceDiscovery.callService(
        'audit-service', // Self-call to audit trail endpoint
        'GET',
        `/audit-trail/entries?${queryParams.toString()}`
      );

      const logs = (auditTrailResponse.data as AuditLogEntry[]) || [];

      // Calculate summary statistics
      const summary = {
        totalActivities: logs.length,
        controlActivities: logs.filter((log: any) =>
          log.context?.tags?.includes('control-assessment')
        ).length,
        evidenceActivities: logs.filter((log: any) =>
          log.context?.tags?.includes('evidence-management')
        ).length,
        reportActivities: logs.filter((log: any) =>
          log.context?.tags?.includes('report-management')
        ).length,
        clientDataAccess: logs.filter((log: any) =>
          log.context?.tags?.includes('client-data-access')
        ).length,
      };

      return {
        logs,
        summary,
        meta: {
          total: logs.length,
          page: params?.page || 1,
          limit: params?.limit || 20,
          totalPages: Math.ceil(logs.length / (params?.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get audit integration logs', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve audit integration logs');
    }
  }

  /**
   * Get audit compliance status and sync information
   */
  async getAuditComplianceStatus(auditId: string): Promise<{
    audit: SOCAudit;
    complianceStatus: {
      overallScore: number;
      controlCompliance: number;
      evidenceCompliance: number;
      documentationCompliance: number;
      riskLevel: 'low' | 'medium' | 'high';
    };
    lastSyncStatus: {
      success: boolean;
      syncedSystems: string[];
      errors: Array<{ system: string; error: string }>;
      lastSyncAt: Date;
    };
    recommendations: Array<{
      category: string;
      priority: 'low' | 'medium' | 'high';
      description: string;
      actions: string[];
    }>;
  }> {
    try {
      const audit = await this.socAuditsService.findOne(auditId);
      const metrics = await this.socAuditsService.getAuditMetrics(auditId);

      // Calculate compliance scores
      const controlCompliance =
        metrics.controlTestingProgress.total > 0
          ? (metrics.controlTestingProgress.effective / metrics.controlTestingProgress.total) * 100
          : 0;

      const evidenceCompliance = 85; // This would be calculated based on evidence completeness
      const documentationCompliance = 90; // This would be calculated based on documentation requirements

      const overallScore = (controlCompliance + evidenceCompliance + documentationCompliance) / 3;

      const riskLevel: 'low' | 'medium' | 'high' =
        overallScore >= 90 ? 'low' : overallScore >= 70 ? 'medium' : 'high';

      // Get last sync status
      const syncResult = await this.auditIntegration.syncWithComplianceSystems(auditId);

      const complianceStatus = {
        overallScore: Math.round(overallScore),
        controlCompliance: Math.round(controlCompliance),
        evidenceCompliance,
        documentationCompliance,
        riskLevel,
      };

      const lastSyncStatus = {
        ...syncResult,
        lastSyncAt: new Date(),
      };

      // Generate recommendations based on compliance gaps
      const recommendations = this.generateComplianceRecommendations(complianceStatus, metrics);

      return {
        audit,
        complianceStatus,
        lastSyncStatus,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to get audit compliance status', {
        auditId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve audit compliance status');
    }
  }

  private generateComplianceRecommendations(
    complianceStatus: any,
    metrics: any
  ): Array<{
    category: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    actions: string[];
  }> {
    const recommendations = [];

    if (complianceStatus.controlCompliance < 80) {
      recommendations.push({
        category: 'Control Testing',
        priority: 'high' as const,
        description: 'Control testing compliance is below acceptable threshold',
        actions: [
          'Complete testing for remaining controls',
          'Review and remediate deficient controls',
          'Update control documentation',
        ],
      });
    }

    if (complianceStatus.evidenceCompliance < 85) {
      recommendations.push({
        category: 'Evidence Collection',
        priority: 'medium' as const,
        description: 'Evidence collection needs improvement',
        actions: [
          'Upload missing evidence files',
          'Review evidence quality and completeness',
          'Obtain additional supporting documentation',
        ],
      });
    }

    if (metrics.findingsBreakdown.remediationRate < 70) {
      recommendations.push({
        category: 'Finding Remediation',
        priority: 'high' as const,
        description: 'Finding remediation rate is below target',
        actions: [
          'Prioritize critical and major findings',
          'Develop remediation plans',
          'Track remediation progress',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Get recent audit activity for dashboard display
   */
  private async getRecentActivity(
    auditId: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    userId?: string;
    metadata?: any;
  }>> {
    try {
      // Fetch recent audit trail entries for this audit
      const auditTrailResponse = await this.serviceDiscovery.callService(
        'audit-service',
        'GET',
        `/audit-trail/entries?auditId=${auditId}&limit=${limit}&sortBy=timestamp&order=desc`
      );

      const auditLogs = (auditTrailResponse.data as AuditLogEntry[]) || [];

      // Transform audit logs into activity format
      return auditLogs.map((log: any) => ({
        id: log.id,
        type: this.mapActionToActivityType(log.action),
        description: this.formatActivityDescription(log),
        timestamp: new Date(log.timestamp),
        userId: log.userId,
        metadata: {
          resource: log.resource,
          context: log.context,
          ipAddress: log.ipAddress,
        },
      }));
    } catch (error) {
      this.logger.error('Failed to get recent activity', {
        auditId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Map audit trail actions to activity types
   */
  private mapActionToActivityType(action: string): string {
    const actionTypeMap: Record<string, string> = {
      'audit.created': 'audit_created',
      'audit.updated': 'audit_updated',
      'audit.status_changed': 'status_change',
      'audit.phase_changed': 'phase_change',
      'control.assessed': 'control_assessment',
      'control.updated': 'control_update',
      'evidence.uploaded': 'evidence_upload',
      'evidence.reviewed': 'evidence_review',
      'report.generated': 'report_generation',
      'report.downloaded': 'report_download',
      'notification.sent': 'notification',
      'integration.sync': 'integration_sync',
      'team.added': 'team_member_added',
      'team.removed': 'team_member_removed',
    };

    return actionTypeMap[action] || 'general_activity';
  }

  /**
   * Format activity description based on audit log entry
   */
  private formatActivityDescription(log: any): string {
    const descriptions: Record<string, (log: any) => string> = {
      'audit.created': () => 'Audit created',
      'audit.updated': (l) => `Audit updated: ${l.details?.fields?.join(', ') || 'general update'}`,
      'audit.status_changed': (l) => `Status changed to ${l.details?.newStatus || 'unknown'}`,
      'audit.phase_changed': (l) => `Phase changed to ${l.details?.newPhase || 'unknown'}`,
      'control.assessed': (l) => `Control ${l.resourceId} assessed as ${l.details?.effectiveness || 'pending'}`,
      'control.updated': (l) => `Control ${l.resourceId} updated`,
      'evidence.uploaded': (l) => `Evidence uploaded: ${l.details?.fileName || 'file'}`,
      'evidence.reviewed': (l) => `Evidence reviewed: ${l.details?.status || 'completed'}`,
      'report.generated': (l) => `${l.details?.format || 'PDF'} report generated`,
      'report.downloaded': (l) => `Report downloaded by ${l.details?.downloadedBy || 'user'}`,
      'notification.sent': (l) => `Notification sent: ${l.details?.type || 'update'}`,
      'integration.sync': (l) => `Synced with ${l.details?.system || 'external system'}`,
      'team.added': (l) => `${l.details?.memberName || 'Team member'} added to audit team`,
      'team.removed': (l) => `${l.details?.memberName || 'Team member'} removed from audit team`,
    };

    const formatter = descriptions[log.action];
    return formatter ? formatter(log) : `Activity: ${log.action}`;
  }

  /**
   * Track audit activity for compliance logging
   */
  async trackActivity(
    auditId: string,
    action: string,
    userId: string,
    details?: any
  ): Promise<void> {
    try {
      const activityPayload = {
        auditId,
        action,
        userId,
        timestamp: new Date(),
        resource: 'audit',
        resourceId: auditId,
        details,
        context: {
          service: 'audit-service',
          method: 'trackActivity',
          tags: ['audit-activity', 'compliance-tracking'],
        },
      };

      // Log to audit trail
      await this.serviceDiscovery.callService(
        'audit-service',
        'POST',
        '/audit-trail/entries',
        activityPayload
      );

      // Send notification for significant activities
      const significantActions = [
        'audit.status_changed',
        'audit.phase_changed',
        'audit.completed',
        'report.generated',
      ];

      if (significantActions.includes(action)) {
        await this.sendAuditNotification(auditId, action.replace('audit.', ''), details);
      }
    } catch (error) {
      this.logger.error('Failed to track audit activity', {
        auditId,
        action,
        error: error.message,
      });
      // Don't throw - activity tracking shouldn't break main flow
    }
  }
}
