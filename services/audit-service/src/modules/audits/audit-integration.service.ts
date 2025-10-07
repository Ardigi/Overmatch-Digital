import { Injectable, Logger } from '@nestjs/common';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { AuditTrailService } from '../audit-trail/audit-trail.service';
import {
  AuditAction,
  AuditResource,
  AuditSeverity,
} from '../audit-trail/entities/audit-entry.entity';
import type { SOCAuditsService } from '../soc-audits/soc-audits.service';
import type { ControlAssessment } from './interfaces/external-responses.interface';

@Injectable()
export class AuditIntegrationService {
  private readonly logger = new Logger(AuditIntegrationService.name);

  constructor(
    private readonly serviceDiscovery: ServiceDiscoveryService,
    private readonly auditTrailService: AuditTrailService,
    private readonly socAuditsService: SOCAuditsService
  ) {}

  /**
   * Track control assessment activities
   */
  async trackControlAssessment(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    auditId: string;
    controlId: string;
    action: 'test' | 'review' | 'approve' | 'remediate';
    result?: 'effective' | 'deficient' | 'not_applicable';
    findings?: string[];
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditTrailService.createEntry({
        organizationId: params.organizationId,
        userId: params.userId,
        userEmail: params.userEmail,
        action: this.mapControlAction(params.action),
        resource: AuditResource.CONTROL,
        resourceId: params.controlId,
        description: `Control ${params.action} - ${params.result || 'in progress'}`,
        severity: this.getControlActionSeverity(params.action, params.result),
        timestamp: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: true,
        metadata: {
          // Custom audit metadata properties can be added as needed
          // auditId is tracked separately in context.correlationId
        },
        context: {
          correlationId: params.auditId,
          tags: ['control-assessment', params.action, params.result].filter(Boolean),
        },
      });

      // Update audit control metrics
      if (params.result) {
        await this.updateAuditControlProgress(params.auditId);
      }

      this.logger.log('Control assessment tracked', {
        auditId: params.auditId,
        controlId: params.controlId,
        action: params.action,
        result: params.result,
      });
    } catch (error) {
      this.logger.error('Failed to track control assessment', {
        auditId: params.auditId,
        controlId: params.controlId,
        error: error.message,
      });
    }
  }

  /**
   * Track evidence collection activities
   */
  async trackEvidenceActivity(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    auditId: string;
    evidenceId: string;
    action: 'upload' | 'review' | 'approve' | 'reject' | 'download';
    evidenceName: string;
    evidenceType: string;
    controlId?: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditTrailService.createEntry({
        organizationId: params.organizationId,
        userId: params.userId,
        userEmail: params.userEmail,
        action: this.mapEvidenceAction(params.action),
        resource: AuditResource.DOCUMENT,
        resourceId: params.evidenceId,
        description: `Evidence ${params.action}: ${params.evidenceName}`,
        severity: this.getEvidenceActionSeverity(params.action),
        timestamp: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: true,
        metadata: {
          // Custom evidence metadata properties can be added as needed
        },
        context: {
          correlationId: params.auditId,
          tags: ['evidence-management', params.action, params.evidenceType].filter(Boolean),
        },
      });

      this.logger.log('Evidence activity tracked', {
        auditId: params.auditId,
        evidenceId: params.evidenceId,
        action: params.action,
      });
    } catch (error) {
      this.logger.error('Failed to track evidence activity', {
        auditId: params.auditId,
        evidenceId: params.evidenceId,
        error: error.message,
      });
    }
  }

  /**
   * Track client data access for audit purposes
   */
  async trackClientDataAccess(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    auditId: string;
    clientId: string;
    dataType: 'client_info' | 'user_data' | 'system_config' | 'compliance_data';
    action: 'view' | 'export' | 'modify';
    purpose: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditTrailService.createEntry({
        organizationId: params.organizationId,
        userId: params.userId,
        userEmail: params.userEmail,
        action: this.mapDataAccessAction(params.action),
        resource: AuditResource.CLIENT,
        resourceId: params.clientId,
        description: `Client ${params.dataType} ${params.action} for audit purposes: ${params.purpose}`,
        severity: this.getDataAccessSeverity(params.dataType, params.action),
        timestamp: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: true,
        metadata: {
          // Custom client data access metadata properties can be added as needed
        },
        context: {
          correlationId: params.auditId,
          tags: ['client-data-access', params.dataType, params.action].filter(Boolean),
        },
      });

      this.logger.log('Client data access tracked', {
        auditId: params.auditId,
        clientId: params.clientId,
        dataType: params.dataType,
        action: params.action,
      });
    } catch (error) {
      this.logger.error('Failed to track client data access', {
        auditId: params.auditId,
        clientId: params.clientId,
        error: error.message,
      });
    }
  }

  /**
   * Track report generation and access
   */
  async trackReportActivity(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    auditId: string;
    reportId: string;
    action: 'generate' | 'download' | 'share' | 'delete';
    reportType: string;
    reportFormat: string;
    recipients?: string[];
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.auditTrailService.createEntry({
        organizationId: params.organizationId,
        userId: params.userId,
        userEmail: params.userEmail,
        action: this.mapReportAction(params.action),
        resource: AuditResource.REPORT,
        resourceId: params.reportId,
        description: `Audit report ${params.action}: ${params.reportType} (${params.reportFormat})`,
        severity: this.getReportActionSeverity(params.action),
        timestamp: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: true,
        metadata: {
          // Custom report metadata properties can be added as needed
        },
        context: {
          correlationId: params.auditId,
          tags: ['report-management', params.action, params.reportType].filter(Boolean),
        },
      });

      this.logger.log('Report activity tracked', {
        auditId: params.auditId,
        reportId: params.reportId,
        action: params.action,
      });
    } catch (error) {
      this.logger.error('Failed to track report activity', {
        auditId: params.auditId,
        reportId: params.reportId,
        error: error.message,
      });
    }
  }

  /**
   * Sync audit data with external compliance systems
   */
  async syncWithComplianceSystems(auditId: string): Promise<{
    success: boolean;
    syncedSystems: string[];
    errors: Array<{ system: string; error: string }>;
  }> {
    const syncedSystems: string[] = [];
    const errors: Array<{ system: string; error: string }> = [];

    try {
      // Get audit data
      const audit = await this.socAuditsService.findOne(auditId);
      const metrics = await this.socAuditsService.getAuditMetrics(auditId);

      // Sync with reporting service for compliance reporting
      try {
        await this.serviceDiscovery.callService('reporting-service', 'POST', '/compliance/sync', {
          auditId,
          audit: {
            id: audit.id,
            auditNumber: audit.auditNumber,
            organizationId: audit.organizationId,
            status: audit.status,
            currentPhase: audit.currentPhase,
            auditType: audit.auditType,
          },
          metrics,
          timestamp: new Date(),
        });
        syncedSystems.push('reporting-service');
      } catch (error) {
        errors.push({ system: 'reporting-service', error: error.message });
      }

      // Sync with notification service for compliance alerts
      try {
        await this.serviceDiscovery.callService(
          'notification-service',
          'POST',
          '/compliance/audit-sync',
          {
            auditId,
            organizationId: audit.organizationId,
            status: audit.status,
            metrics,
            timestamp: new Date(),
          }
        );
        syncedSystems.push('notification-service');
      } catch (error) {
        errors.push({ system: 'notification-service', error: error.message });
      }

      return {
        success: errors.length === 0,
        syncedSystems,
        errors,
      };
    } catch (error) {
      this.logger.error('Failed to sync with compliance systems', {
        auditId,
        error: error.message,
      });
      return {
        success: false,
        syncedSystems,
        errors: [{ system: 'sync-process', error: error.message }],
      };
    }
  }

  private async updateAuditControlProgress(auditId: string): Promise<void> {
    try {
      // Get updated control assessments
      const controlAssessments = await this.serviceDiscovery.callService(
        'control-service',
        'GET',
        `/controls/assessments?auditId=${auditId}`
      );

      const assessments = (controlAssessments.data as ControlAssessment[]) || [];
      const metrics = {
        totalControls: assessments.length,
        testedControls: assessments.filter((a) => a.status === 'tested').length,
        effectiveControls: assessments.filter((a) => a.effectiveness === 'effective').length,
        deficientControls: assessments.filter((a) => a.effectiveness === 'deficient').length,
      };

      // Update the audit record
      await this.socAuditsService.update(auditId, metrics, 'system');
    } catch (error) {
      this.logger.error('Failed to update audit control progress', {
        auditId,
        error: error.message,
      });
    }
  }

  private mapControlAction(action: string): AuditAction {
    const actionMap: Record<string, AuditAction> = {
      test: AuditAction.UPDATE,
      review: AuditAction.READ,
      approve: AuditAction.APPROVE,
      remediate: AuditAction.UPDATE,
    };
    return actionMap[action] || AuditAction.CUSTOM;
  }

  private mapEvidenceAction(action: string): AuditAction {
    const actionMap: Record<string, AuditAction> = {
      upload: AuditAction.CREATE,
      review: AuditAction.READ,
      approve: AuditAction.APPROVE,
      reject: AuditAction.REJECT,
      download: AuditAction.EXPORT,
    };
    return actionMap[action] || AuditAction.CUSTOM;
  }

  private mapDataAccessAction(action: string): AuditAction {
    const actionMap: Record<string, AuditAction> = {
      view: AuditAction.READ,
      export: AuditAction.EXPORT,
      modify: AuditAction.UPDATE,
    };
    return actionMap[action] || AuditAction.READ;
  }

  private mapReportAction(action: string): AuditAction {
    const actionMap: Record<string, AuditAction> = {
      generate: AuditAction.CREATE,
      download: AuditAction.EXPORT,
      share: AuditAction.EXPORT, // Use EXPORT instead of SHARE
      delete: AuditAction.DELETE,
    };
    return actionMap[action] || AuditAction.CUSTOM;
  }

  private getControlActionSeverity(action: string, result?: string): AuditSeverity {
    if (result === 'deficient') return AuditSeverity.HIGH;
    if (action === 'approve') return AuditSeverity.MEDIUM;
    return AuditSeverity.INFO;
  }

  private getEvidenceActionSeverity(action: string): AuditSeverity {
    if (action === 'reject') return AuditSeverity.MEDIUM;
    if (action === 'download' || action === 'export') return AuditSeverity.MEDIUM;
    return AuditSeverity.INFO;
  }

  private getDataAccessSeverity(dataType: string, action: string): AuditSeverity {
    if (dataType === 'compliance_data' || dataType === 'system_config') {
      return action === 'modify' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;
    }
    if (action === 'export') return AuditSeverity.MEDIUM;
    return AuditSeverity.INFO;
  }

  private getReportActionSeverity(action: string): AuditSeverity {
    if (action === 'delete') return AuditSeverity.HIGH;
    if (action === 'share' || action === 'download') return AuditSeverity.MEDIUM;
    return AuditSeverity.INFO;
  }
}
