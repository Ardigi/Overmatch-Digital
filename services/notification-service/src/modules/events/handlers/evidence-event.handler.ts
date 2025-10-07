import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface EvidenceEventData {
  evidenceId: string;
  evidenceName: string;
  evidenceType?: string;
  description?: string;
  status?: string;
  controlId?: string;
  controlName?: string;
  collectorId?: string;
  collectorEmail?: string;
  reviewerId?: string;
  reviewerEmail?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  collectionDate?: Date;
  expirationDate?: Date;
  fileSize?: number;
  fileName?: string;
  verificationStatus?: string;
  rejectionReason?: string;
}

@Injectable()
export class EvidenceEventHandler extends BaseEventHandler<EvidenceEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'evidence';
  }

  extractEventData(payload: any): EvidenceEventData {
    return {
      evidenceId: payload.evidenceId || payload.id,
      evidenceName: payload.evidenceName || payload.name || payload.fileName,
      evidenceType: payload.evidenceType || payload.type,
      description: payload.description,
      status: payload.status,
      controlId: payload.controlId,
      controlName: payload.controlName,
      collectorId: payload.collectorId || payload.uploadedBy,
      collectorEmail: payload.collectorEmail || payload.uploaderEmail,
      reviewerId: payload.reviewerId || payload.reviewer,
      reviewerEmail: payload.reviewerEmail,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      collectionDate: payload.collectionDate ? new Date(payload.collectionDate) : undefined,
      expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : undefined,
      fileSize: payload.fileSize,
      fileName: payload.fileName,
      verificationStatus: payload.verificationStatus,
      rejectionReason: payload.rejectionReason,
    };
  }

  async evaluateNotificationRules(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'evidence.uploaded':
        decisions.push(...(await this.evaluateEvidenceUploaded(data, context)));
        break;
      case 'evidence.verified':
        decisions.push(...(await this.evaluateEvidenceVerified(data, context)));
        break;
      case 'evidence.rejected':
        decisions.push(...(await this.evaluateEvidenceRejected(data, context)));
        break;
      case 'evidence.expiring':
        decisions.push(...(await this.evaluateEvidenceExpiring(data, context)));
        break;
      case 'evidence.expired':
        decisions.push(...(await this.evaluateEvidenceExpired(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const collectorData = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
    const reviewerData = data.reviewerId ? await this.userDataService.getUserById(data.reviewerId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        evidenceName: data.evidenceName,
        evidenceType: data.evidenceType,
        controlName: data.controlName,
        collectorName: collectorData?.name || data.collectorEmail || 'Evidence Collector',
        reviewerName: reviewerData?.name || data.reviewerEmail || 'Reviewer',
        organizationName: orgData?.name || 'Your Organization',
        evidenceUrl: `${process.env.APP_URL}/evidence/${data.evidenceId}`,
        controlUrl: data.controlId ? `${process.env.APP_URL}/controls/${data.controlId}` : null,
        fileSize: this.formatFileSize(data.fileSize),
        daysUntilExpiration: data.expirationDate ? this.calculateDaysUntilExpiration(data.expirationDate) : null,
      },
    };
  }

  private async evaluateEvidenceUploaded(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Confirmation to uploader
    if (data.collectorId || data.collectorEmail) {
      const collector = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_UPLOAD_CONFIRMATION',
        channel: NotificationChannel.EMAIL,
        priority: 'low',
        recipients: [{
          id: data.collectorId || 'unknown',
          email: collector?.email || data.collectorEmail,
          name: collector?.name,
        }],
        variables: {
          uploadTime: context.timestamp,
          reviewStatus: 'Pending review',
        },
      });
    }

    // Notify reviewer if assigned
    if (data.reviewerId || data.reviewerEmail) {
      const reviewer = data.reviewerId ? await this.userDataService.getUserById(data.reviewerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_REVIEW_REQUEST',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.reviewerId || 'unknown',
          email: reviewer?.email || data.reviewerEmail,
          name: reviewer?.name,
        }],
        variables: {
          reviewDeadline: this.calculateReviewDeadline(),
          reviewUrl: `${process.env.APP_URL}/evidence/${data.evidenceId}/review`,
        },
      });

      // In-app notification for immediate visibility
      if (data.reviewerId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'EVIDENCE_REVIEW_REQUEST_INAPP',
          channel: NotificationChannel.IN_APP,
          priority: 'high',
          recipients: [{
            id: data.reviewerId,
            userId: data.reviewerId,
          }],
          variables: {
            actionUrl: `/evidence/${data.evidenceId}/review`,
          },
        });
      }
    }

    // Notify control owner if evidence is for a control
    if (data.controlId) {
      const controlOwner = await this.getControlOwner(data.controlId, data.organizationId);
      if (controlOwner) {
        decisions.push({
          shouldSend: true,
          templateCode: 'EVIDENCE_UPLOADED_FOR_CONTROL',
          channel: NotificationChannel.IN_APP,
          priority: 'medium',
          recipients: [{
            id: controlOwner.id,
            userId: controlOwner.id,
          }],
          variables: {
            controlName: data.controlName,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateEvidenceVerified(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify collector of verification
    if (data.collectorId || data.collectorEmail) {
      const collector = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_VERIFIED',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.collectorId || 'unknown',
          email: collector?.email || data.collectorEmail,
          name: collector?.name,
        }],
        variables: {
          verifiedBy: data.reviewerId ? 
            (await this.userDataService.getUserById(data.reviewerId))?.name :
            data.reviewerEmail,
          verificationDate: context.timestamp,
        },
      });
    }

    // Update control compliance status if applicable
    if (data.controlId) {
      const controlOwner = await this.getControlOwner(data.controlId, data.organizationId);
      if (controlOwner) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_EVIDENCE_VERIFIED',
          channel: NotificationChannel.IN_APP,
          priority: 'low',
          recipients: [{
            id: controlOwner.id,
            userId: controlOwner.id,
          }],
          variables: {
            controlName: data.controlName,
            evidenceCount: data.metadata?.totalEvidenceForControl,
          },
        });
      }
    }

    // Notify compliance team if milestone reached
    if (data.metadata?.complianceMilestone) {
      const complianceTeam = await this.getComplianceTeam(data.organizationId);
      decisions.push({
        shouldSend: true,
        templateCode: 'COMPLIANCE_MILESTONE_REACHED',
        channel: NotificationChannel.SLACK,
        priority: 'medium',
        recipients: complianceTeam,
        variables: {
          milestone: data.metadata.complianceMilestone,
          progress: data.metadata.complianceProgress,
        },
      });
    }

    return decisions;
  }

  private async evaluateEvidenceRejected(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Urgent notification to collector with rejection details
    if (data.collectorId || data.collectorEmail) {
      const collector = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_REJECTED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.collectorId || 'unknown',
          email: collector?.email || data.collectorEmail,
          name: collector?.name,
        }],
        variables: {
          rejectedBy: data.reviewerId ? 
            (await this.userDataService.getUserById(data.reviewerId))?.name :
            data.reviewerEmail,
          rejectionReason: data.rejectionReason || 'Evidence does not meet requirements',
          rejectionDate: context.timestamp,
          actionRequired: 'Please review the feedback and resubmit evidence',
        },
      });

      // Push notification for immediate attention
      if (data.collectorId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'EVIDENCE_REJECTED_PUSH',
          channel: NotificationChannel.PUSH,
          priority: 'urgent',
          recipients: [{
            id: data.collectorId,
            userId: data.collectorId,
          }],
          variables: {
            evidenceName: data.evidenceName,
          },
        });
      }
    }

    // Alert control owner of evidence rejection
    if (data.controlId) {
      const controlOwner = await this.getControlOwner(data.controlId, data.organizationId);
      if (controlOwner) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_EVIDENCE_REJECTED',
          channel: NotificationChannel.EMAIL,
          priority: 'high',
          recipients: [{
            id: controlOwner.id,
            email: controlOwner.email,
            name: controlOwner.name,
          }],
          variables: {
            controlName: data.controlName,
            impact: 'Control may not meet compliance requirements',
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateEvidenceExpiring(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];
    const daysUntilExpiration = data.expirationDate ? 
      this.calculateDaysUntilExpiration(data.expirationDate) : 30;

    // Notify collector about upcoming expiration
    if (data.collectorId || data.collectorEmail) {
      const collector = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_EXPIRING_SOON',
        channel: NotificationChannel.EMAIL,
        priority: daysUntilExpiration <= 7 ? 'high' : 'medium',
        recipients: [{
          id: data.collectorId || 'unknown',
          email: collector?.email || data.collectorEmail,
          name: collector?.name,
        }],
        variables: {
          expirationDate: data.expirationDate,
          daysRemaining: daysUntilExpiration,
          renewalUrl: `${process.env.APP_URL}/evidence/${data.evidenceId}/renew`,
        },
      });

      // SMS alert if expiring very soon
      if (daysUntilExpiration <= 3) {
        const userPrefs = await this.getUserPreferences(data.collectorId);
        if (userPrefs?.enableSmsAlerts && userPrefs?.phone) {
          decisions.push({
            shouldSend: true,
            templateCode: 'EVIDENCE_EXPIRING_URGENT_SMS',
            channel: NotificationChannel.SMS,
            priority: 'urgent',
            recipients: [{
              id: data.collectorId,
              phone: userPrefs.phone,
            }],
            variables: {
              evidenceName: data.evidenceName,
              daysRemaining: daysUntilExpiration,
            },
          });
        }
      }
    }

    // Notify control owner
    if (data.controlId) {
      const controlOwner = await this.getControlOwner(data.controlId, data.organizationId);
      if (controlOwner && daysUntilExpiration <= 14) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_EVIDENCE_EXPIRING',
          channel: NotificationChannel.IN_APP,
          priority: 'high',
          recipients: [{
            id: controlOwner.id,
            userId: controlOwner.id,
          }],
          variables: {
            controlName: data.controlName,
            evidenceCount: data.metadata?.expiringEvidenceCount || 1,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateEvidenceExpired(
    data: EvidenceEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify collector of expiration
    if (data.collectorId || data.collectorEmail) {
      const collector = data.collectorId ? await this.userDataService.getUserById(data.collectorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'EVIDENCE_EXPIRED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.collectorId || 'unknown',
          email: collector?.email || data.collectorEmail,
          name: collector?.name,
        }],
        variables: {
          expiredDate: context.timestamp,
          actionRequired: 'New evidence must be collected immediately',
          uploadUrl: `${process.env.APP_URL}/evidence/upload?controlId=${data.controlId}`,
        },
      });
    }

    // Alert control owner - control may be non-compliant
    if (data.controlId) {
      const controlOwner = await this.getControlOwner(data.controlId, data.organizationId);
      if (controlOwner) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_EVIDENCE_EXPIRED',
          channel: NotificationChannel.EMAIL,
          priority: 'urgent',
          recipients: [{
            id: controlOwner.id,
            email: controlOwner.email,
            name: controlOwner.name,
          }],
          variables: {
            controlName: data.controlName,
            complianceImpact: 'Control is now non-compliant due to expired evidence',
          },
        });
      }
    }

    // Alert compliance team
    const complianceTeam = await this.getComplianceTeam(data.organizationId);
    decisions.push({
      shouldSend: true,
      templateCode: 'EVIDENCE_EXPIRED_COMPLIANCE_ALERT',
      channel: NotificationChannel.SLACK,
      priority: 'urgent',
      recipients: complianceTeam,
      variables: {
        controlName: data.controlName,
        evidenceName: data.evidenceName,
        urgency: 'Immediate action required to maintain compliance',
      },
    });

    return decisions;
  }

  private formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private calculateDaysUntilExpiration(expirationDate: Date): number {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private calculateReviewDeadline(): string {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3); // 3 days for review
    return deadline.toISOString();
  }

  private async getControlOwner(controlId: string, organizationId: string): Promise<any> {
    // Would typically query the control service for owner information
    return null;
  }

  private async getComplianceTeam(organizationId: string): Promise<any[]> {
    // Would typically query for users with compliance role
    return [];
  }
}