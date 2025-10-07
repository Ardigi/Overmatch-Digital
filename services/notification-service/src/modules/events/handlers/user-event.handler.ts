import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface UserEventData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class UserEventHandler extends BaseEventHandler<UserEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'user';
  }

  extractEventData(payload: any): UserEventData {
    return {
      userId: payload.userId || payload.id,
      email: payload.email || payload.userEmail,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role || payload.userRole,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
    };
  }

  async evaluateNotificationRules(
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Evaluate based on event type
    switch (context.eventType) {
      case 'user.created':
        decisions.push(...(await this.evaluateUserCreated(data, context)));
        break;
      case 'user.updated':
        decisions.push(...(await this.evaluateUserUpdated(data, context)));
        break;
      case 'user.deleted':
        decisions.push(...(await this.evaluateUserDeleted(data, context)));
        break;
      case 'user.role.changed':
        decisions.push(...(await this.evaluateRoleChanged(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    // Fetch additional user data if needed
    const userData = await this.userDataService.getUserById(data.userId);
    const orgData = await this.userDataService.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        userName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email,
        userEmail: data.email,
        userRole: data.role,
        organizationName: orgData?.name || 'Your Organization',
        supportEmail: orgData?.supportEmail || 'support@example.com',
        loginUrl: process.env.APP_URL || 'https://app.soc-compliance.com',
      },
    };
  }

  private async evaluateUserCreated(
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Welcome email to new user
    decisions.push({
      shouldSend: true,
      templateCode: 'USER_WELCOME',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: [{
        id: data.userId,
        email: data.email,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      }],
      variables: {
        firstName: data.firstName,
        activationLink: `${process.env.APP_URL}/activate?token=${data.metadata?.activationToken}`,
      },
    });

    // In-app notification
    decisions.push({
      shouldSend: true,
      templateCode: 'USER_WELCOME_INAPP',
      channel: NotificationChannel.IN_APP,
      priority: 'medium',
      recipients: [{
        id: data.userId,
        userId: data.userId,
      }],
      variables: {
        firstName: data.firstName,
      },
    });

    // Notify admins of new user (if configured)
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.notifyAdminsOnNewUser) {
      const admins = await this.userDataService.getOrganizationAdmins(data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'NEW_USER_ADMIN_NOTIFICATION',
        channel: NotificationChannel.EMAIL,
        priority: 'low',
        recipients: admins.map(admin => ({
          id: admin.id,
          email: admin.email,
          name: admin.name,
        })),
        variables: {
          newUserName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          newUserEmail: data.email,
          newUserRole: data.role,
        },
      });
    }

    return decisions;
  }

  private async evaluateUserUpdated(
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Check if critical fields were updated
    const criticalFields = ['email', 'password', 'twoFactorEnabled'];
    const updatedCriticalFields = Object.keys(data.changes || {}).filter(
      field => criticalFields.includes(field)
    );

    if (updatedCriticalFields.length > 0) {
      // Security notification
      decisions.push({
        shouldSend: true,
        templateCode: 'ACCOUNT_SECURITY_UPDATE',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.userId,
          email: data.email,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        }],
        variables: {
          updatedFields: updatedCriticalFields,
          updateTime: context.timestamp,
          ipAddress: data.metadata?.ipAddress,
        },
      });

      // SMS alert if phone number available
      const userPrefs = await this.getUserPreferences(data.userId);
      if (userPrefs?.enableSmsAlerts && userPrefs?.phone) {
        decisions.push({
          shouldSend: true,
          templateCode: 'ACCOUNT_SECURITY_UPDATE_SMS',
          channel: NotificationChannel.SMS,
          priority: 'urgent',
          recipients: [{
            id: data.userId,
            phone: userPrefs.phone,
          }],
          variables: {
            action: `${updatedCriticalFields.join(', ')} updated`,
          },
        });
      }
    }

    // Profile update confirmation
    if (data.changes && Object.keys(data.changes).length > 0) {
      decisions.push({
        shouldSend: true,
        templateCode: 'PROFILE_UPDATE_CONFIRMATION',
        channel: NotificationChannel.IN_APP,
        priority: 'low',
        recipients: [{
          id: data.userId,
          userId: data.userId,
        }],
        variables: {
          updatedFields: Object.keys(data.changes),
        },
      });
    }

    return decisions;
  }

  private async evaluateUserDeleted(
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Account deletion confirmation
    decisions.push({
      shouldSend: true,
      templateCode: 'ACCOUNT_DELETED',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: [{
        id: data.userId,
        email: data.email,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      }],
      variables: {
        deletionDate: context.timestamp,
        dataRetentionDays: 30,
      },
    });

    // Notify team members if user was part of teams
    const teams = await this.userDataService.getUserTeams(data.userId);
    if (teams && teams.length > 0) {
      for (const team of teams) {
        const teamMembers = await this.userDataService.getTeamMembers(team.id);
        
        decisions.push({
          shouldSend: true,
          templateCode: 'TEAM_MEMBER_REMOVED',
          channel: NotificationChannel.IN_APP,
          priority: 'medium',
          recipients: teamMembers.filter(m => m.id !== data.userId).map(member => ({
            id: member.id,
            userId: member.id,
          })),
          variables: {
            removedUserName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            teamName: team.name,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateRoleChanged(
    data: UserEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    const oldRole = data.changes?.oldRole || data.changes?.previousRole;
    const newRole = data.role || data.changes?.newRole;

    // Notify user of role change
    decisions.push({
      shouldSend: true,
      templateCode: 'ROLE_CHANGED',
      channel: NotificationChannel.EMAIL,
      priority: 'high',
      recipients: [{
        id: data.userId,
        email: data.email,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      }],
      variables: {
        oldRole,
        newRole,
        changedBy: data.metadata?.changedBy,
        reason: data.metadata?.reason,
      },
    });

    // In-app notification
    decisions.push({
      shouldSend: true,
      templateCode: 'ROLE_CHANGED_INAPP',
      channel: NotificationChannel.IN_APP,
      priority: 'high',
      recipients: [{
        id: data.userId,
        userId: data.userId,
      }],
      variables: {
        oldRole,
        newRole,
      },
    });

    // If promoted to admin, send additional onboarding
    if (newRole === 'admin' && oldRole !== 'admin') {
      decisions.push({
        shouldSend: true,
        templateCode: 'ADMIN_ONBOARDING',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.userId,
          email: data.email,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        }],
        variables: {
          adminGuideUrl: `${process.env.APP_URL}/docs/admin-guide`,
          trainingVideoUrl: `${process.env.APP_URL}/training/admin`,
        },
      });
    }

    return decisions;
  }
}