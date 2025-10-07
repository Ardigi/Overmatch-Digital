import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface PolicyEventData {
  policyId: string;
  policyName: string;
  policyCode?: string;
  description?: string;
  version?: string;
  status?: string;
  framework?: string;
  category?: string;
  ownerId?: string;
  ownerEmail?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  approvers?: string[];
  reviewers?: string[];
  publishedAt?: Date;
  effectiveDate?: Date;
}

@Injectable()
export class PolicyEventHandler extends BaseEventHandler<PolicyEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'policy';
  }

  extractEventData(payload: any): PolicyEventData {
    return {
      policyId: payload.policyId || payload.id,
      policyName: payload.policyName || payload.name,
      policyCode: payload.policyCode || payload.code,
      description: payload.description,
      version: payload.version,
      status: payload.status,
      framework: payload.framework || payload.complianceFramework,
      category: payload.category,
      ownerId: payload.ownerId || payload.owner,
      ownerEmail: payload.ownerEmail,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      approvers: payload.approvers || [],
      reviewers: payload.reviewers || [],
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : undefined,
      effectiveDate: payload.effectiveDate ? new Date(payload.effectiveDate) : undefined,
    };
  }

  async evaluateNotificationRules(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'policy.created':
        decisions.push(...(await this.evaluatePolicyCreated(data, context)));
        break;
      case 'policy.updated':
        decisions.push(...(await this.evaluatePolicyUpdated(data, context)));
        break;
      case 'policy.approved':
        decisions.push(...(await this.evaluatePolicyApproved(data, context)));
        break;
      case 'policy.rejected':
        decisions.push(...(await this.evaluatePolicyRejected(data, context)));
        break;
      case 'policy.published':
        decisions.push(...(await this.evaluatePolicyPublished(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const ownerData = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        policyName: data.policyName,
        policyCode: data.policyCode,
        policyDescription: data.description,
        policyVersion: data.version || '1.0',
        policyFramework: data.framework,
        policyCategory: data.category,
        policyOwner: ownerData?.name || data.ownerEmail || 'Policy Owner',
        organizationName: orgData?.name || 'Your Organization',
        policyUrl: `${process.env.APP_URL}/policies/${data.policyId}`,
        complianceFrameworks: orgData?.complianceFrameworks?.join(', ') || 'SOC 2',
      },
    };
  }

  private async evaluatePolicyCreated(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify policy owner
    if (data.ownerId || data.ownerEmail) {
      const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_CREATED_OWNER',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.ownerId || 'unknown',
          email: owner?.email || data.ownerEmail,
          name: owner?.name,
        }],
        variables: {
          actionRequired: 'Please review and finalize the policy details',
        },
      });
    }

    // Notify reviewers
    if (data.reviewers && data.reviewers.length > 0) {
      const reviewerUsers = await this.userDataService.getUsersByIds(data.reviewers);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_REVIEW_REQUEST',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: reviewerUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
        })),
        variables: {
          reviewDeadline: this.calculateReviewDeadline(data.effectiveDate),
        },
      });

      // In-app notification for reviewers
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_REVIEW_REQUEST_INAPP',
        channel: NotificationChannel.IN_APP,
        priority: 'medium',
        recipients: reviewerUsers.map(user => ({
          id: user.id,
          userId: user.id,
        })),
        variables: {
          actionUrl: `/policies/${data.policyId}/review`,
        },
      });
    }

    // Notify compliance team
    const complianceTeam = await this.getComplianceTeamMembers(data.organizationId);
    if (complianceTeam.length > 0) {
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_CREATED_COMPLIANCE',
        channel: NotificationChannel.SLACK,
        priority: 'low',
        recipients: complianceTeam,
        variables: {
          policyLink: `${process.env.APP_URL}/policies/${data.policyId}`,
        },
      });
    }

    return decisions;
  }

  private async evaluatePolicyUpdated(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Check if critical fields were updated
    const criticalFields = ['framework', 'category', 'effectiveDate', 'status'];
    const updatedCriticalFields = Object.keys(data.changes || {}).filter(
      field => criticalFields.includes(field)
    );

    if (updatedCriticalFields.length > 0) {
      // Notify all stakeholders of critical changes
      const stakeholders = await this.getPolicyStakeholders(data.policyId, data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_CRITICAL_UPDATE',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: stakeholders,
        variables: {
          updatedFields: updatedCriticalFields,
          changesSummary: this.summarizeChanges(data.changes),
        },
      });
    } else if (data.changes && Object.keys(data.changes).length > 0) {
      // Non-critical updates - notify owner only
      if (data.ownerId || data.ownerEmail) {
        const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
        
        decisions.push({
          shouldSend: true,
          templateCode: 'POLICY_UPDATED',
          channel: NotificationChannel.IN_APP,
          priority: 'low',
          recipients: [{
            id: data.ownerId || 'unknown',
            userId: data.ownerId,
          }],
          variables: {
            updateSummary: this.summarizeChanges(data.changes),
          },
        });
      }
    }

    // If version changed, notify about new version
    if (data.changes?.version) {
      const subscribers = await this.getPolicySubscribers(data.policyId, data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_NEW_VERSION',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: subscribers,
        variables: {
          oldVersion: data.changes.version.old,
          newVersion: data.changes.version.new || data.version,
          changelog: data.metadata?.changelog,
        },
      });
    }

    return decisions;
  }

  private async evaluatePolicyApproved(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify policy owner
    if (data.ownerId || data.ownerEmail) {
      const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_APPROVED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.ownerId || 'unknown',
          email: owner?.email || data.ownerEmail,
          name: owner?.name,
        }],
        variables: {
          approvedBy: data.metadata?.approvedBy,
          approvalDate: context.timestamp,
          nextSteps: 'Policy will be published on the effective date',
        },
      });
    }

    // Notify stakeholders
    const stakeholders = await this.getPolicyStakeholders(data.policyId, data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'POLICY_APPROVED_STAKEHOLDER',
      channel: NotificationChannel.EMAIL,
      priority: 'medium',
      recipients: stakeholders,
      variables: {
        effectiveDate: data.effectiveDate,
      },
    });

    // Teams notification
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.metadata?.teamsWebhookUrl) {
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_APPROVED_TEAMS',
        channel: NotificationChannel.TEAMS,
        priority: 'medium',
        recipients: [{
          id: 'teams',
          webhookUrl: orgSettings.metadata.teamsWebhookUrl,
        }],
        variables: {},
      });
    }

    return decisions;
  }

  private async evaluatePolicyRejected(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify policy owner with rejection details
    if (data.ownerId || data.ownerEmail) {
      const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_REJECTED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.ownerId || 'unknown',
          email: owner?.email || data.ownerEmail,
          name: owner?.name,
        }],
        variables: {
          rejectedBy: data.metadata?.rejectedBy,
          rejectionReason: data.metadata?.rejectionReason || 'Please review the feedback and resubmit',
          rejectionDate: context.timestamp,
        },
      });

      // In-app notification for immediate visibility
      if (data.ownerId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'POLICY_REJECTED_INAPP',
          channel: NotificationChannel.IN_APP,
          priority: 'urgent',
          recipients: [{
            id: data.ownerId,
            userId: data.ownerId,
          }],
          variables: {
            actionUrl: `/policies/${data.policyId}/edit`,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluatePolicyPublished(
    data: PolicyEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify all users in the organization
    const allUsers = await this.getOrganizationUsers(data.organizationId);
    
    // Batch notification for all users
    decisions.push({
      shouldSend: true,
      templateCode: 'POLICY_PUBLISHED',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: allUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
      })),
      variables: {
        policyEffectiveDate: data.effectiveDate || data.publishedAt,
        acknowledgmentRequired: data.metadata?.requiresAcknowledgment || false,
        acknowledgmentUrl: `${process.env.APP_URL}/policies/${data.policyId}/acknowledge`,
      },
    });

    // In-app notification for all users
    decisions.push({
      shouldSend: true,
      templateCode: 'POLICY_PUBLISHED_INAPP',
      channel: NotificationChannel.IN_APP,
      priority: 'high',
      recipients: allUsers.map(user => ({
        id: user.id,
        userId: user.id,
      })),
      variables: {
        actionUrl: `/policies/${data.policyId}`,
      },
    });

    // Slack announcement
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.metadata?.slackChannelId) {
      decisions.push({
        shouldSend: true,
        templateCode: 'POLICY_PUBLISHED_SLACK',
        channel: NotificationChannel.SLACK,
        priority: 'medium',
        recipients: [{
          id: 'slack',
          channelId: orgSettings.metadata.slackChannelId,
        }],
        variables: {
          policyUrl: `${process.env.APP_URL}/policies/${data.policyId}`,
        },
      });
    }

    return decisions;
  }

  private calculateReviewDeadline(effectiveDate?: Date): string {
    if (!effectiveDate) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7); // Default 7 days
      return deadline.toISOString();
    }
    
    const deadline = new Date(effectiveDate);
    deadline.setDate(deadline.getDate() - 3); // 3 days before effective date
    return deadline.toISOString();
  }

  private summarizeChanges(changes?: Record<string, any>): string {
    if (!changes || Object.keys(changes).length === 0) {
      return 'No specific changes recorded';
    }

    const summary = Object.entries(changes)
      .map(([field, value]) => {
        if (typeof value === 'object' && value.old && value.new) {
          return `${field}: ${value.old} → ${value.new}`;
        }
        return `${field} updated`;
      })
      .join(', ');

    return summary;
  }

  private async getPolicyStakeholders(policyId: string, organizationId: string): Promise<any[]> {
    // This would typically query the database for users related to the policy
    // For now, return organization admins
    return await this.userDataService.getOrganizationAdmins(organizationId);
  }

  private async getPolicySubscribers(policyId: string, organizationId: string): Promise<any[]> {
    // This would query for users who have subscribed to policy updates
    // For now, return all users with compliance role
    const allUsers = await this.getOrganizationUsers(organizationId);
    return allUsers.filter(user => 
      user.role === 'compliance' || 
      user.role === 'admin' || 
      user.metadata?.subscribedPolicies?.includes(policyId)
    );
  }

  private async getComplianceTeamMembers(organizationId: string): Promise<any[]> {
    const allUsers = await this.getOrganizationUsers(organizationId);
    return allUsers
      .filter(user => user.role === 'compliance' || user.metadata?.team === 'compliance')
      .map(user => ({
        id: user.id,
        channelId: user.metadata?.slackUserId,
      }));
  }

  private async getOrganizationUsers(organizationId: string): Promise<any[]> {
    // This would typically make a call to the auth service to get all users
    // For now, returning a placeholder
    try {
      // Would call: this.userDataService.getOrganizationUsers(organizationId)
      return [];
    } catch (error) {
      this.logger.error(`Failed to fetch organization users: ${error.message}`);
      return [];
    }
  }
}