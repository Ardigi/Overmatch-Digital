import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface ControlEventData {
  controlId: string;
  controlName: string;
  controlCode?: string;
  description?: string;
  status?: string;
  implementationStatus?: string;
  testingStatus?: string;
  framework?: string;
  category?: string;
  assigneeId?: string;
  assigneeEmail?: string;
  ownerId?: string;
  ownerEmail?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  dueDate?: Date;
  completionDate?: Date;
  testResults?: any;
  findings?: any[];
}

@Injectable()
export class ControlEventHandler extends BaseEventHandler<ControlEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'control';
  }

  extractEventData(payload: any): ControlEventData {
    return {
      controlId: payload.controlId || payload.id,
      controlName: payload.controlName || payload.name,
      controlCode: payload.controlCode || payload.code,
      description: payload.description,
      status: payload.status,
      implementationStatus: payload.implementationStatus,
      testingStatus: payload.testingStatus,
      framework: payload.framework || payload.complianceFramework,
      category: payload.category,
      assigneeId: payload.assigneeId || payload.assignee,
      assigneeEmail: payload.assigneeEmail,
      ownerId: payload.ownerId || payload.owner,
      ownerEmail: payload.ownerEmail,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      completionDate: payload.completionDate ? new Date(payload.completionDate) : undefined,
      testResults: payload.testResults,
      findings: payload.findings || [],
    };
  }

  async evaluateNotificationRules(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'control.status.changed':
        decisions.push(...(await this.evaluateControlStatusChanged(data, context)));
        break;
      case 'control.assigned':
        decisions.push(...(await this.evaluateControlAssigned(data, context)));
        break;
      case 'control.implementation.completed':
        decisions.push(...(await this.evaluateImplementationCompleted(data, context)));
        break;
      case 'control.test.failed':
        decisions.push(...(await this.evaluateTestFailed(data, context)));
        break;
      case 'control.test.passed':
        decisions.push(...(await this.evaluateTestPassed(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const assigneeData = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
    const ownerData = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        controlName: data.controlName,
        controlCode: data.controlCode,
        controlDescription: data.description,
        controlFramework: data.framework,
        controlCategory: data.category,
        assigneeName: assigneeData?.name || data.assigneeEmail || 'Assignee',
        ownerName: ownerData?.name || data.ownerEmail || 'Control Owner',
        organizationName: orgData?.name || 'Your Organization',
        controlUrl: `${process.env.APP_URL}/controls/${data.controlId}`,
        dueDate: data.dueDate?.toLocaleDateString(),
        daysUntilDue: data.dueDate ? this.calculateDaysUntilDue(data.dueDate) : null,
      },
    };
  }

  private async evaluateControlStatusChanged(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];
    const oldStatus = data.changes?.status?.old || data.changes?.previousStatus;
    const newStatus = data.status || data.changes?.status?.new;

    // Notify assignee of status change
    if (data.assigneeId || data.assigneeEmail) {
      const assignee = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_STATUS_CHANGED',
        channel: NotificationChannel.EMAIL,
        priority: this.getStatusChangePriority(oldStatus, newStatus),
        recipients: [{
          id: data.assigneeId || 'unknown',
          email: assignee?.email || data.assigneeEmail,
          name: assignee?.name,
        }],
        variables: {
          oldStatus,
          newStatus,
          changedBy: data.metadata?.changedBy,
          reason: data.metadata?.reason,
        },
      });

      // In-app notification
      if (data.assigneeId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_STATUS_CHANGED_INAPP',
          channel: NotificationChannel.IN_APP,
          priority: 'medium',
          recipients: [{
            id: data.assigneeId,
            userId: data.assigneeId,
          }],
          variables: {
            oldStatus,
            newStatus,
            actionUrl: `/controls/${data.controlId}`,
          },
        });
      }
    }

    // Special handling for critical status changes
    if (this.isCriticalStatusChange(oldStatus, newStatus)) {
      // Notify control owner
      if (data.ownerId || data.ownerEmail) {
        const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
        
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_CRITICAL_STATUS_CHANGE',
          channel: NotificationChannel.EMAIL,
          priority: 'urgent',
          recipients: [{
            id: data.ownerId || 'unknown',
            email: owner?.email || data.ownerEmail,
            name: owner?.name,
          }],
          variables: {
            oldStatus,
            newStatus,
            impact: this.assessStatusChangeImpact(oldStatus, newStatus),
          },
        });
      }

      // Notify compliance team
      const complianceTeam = await this.getComplianceTeam(data.organizationId);
      if (complianceTeam.length > 0) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_CRITICAL_STATUS_COMPLIANCE',
          channel: NotificationChannel.SLACK,
          priority: 'high',
          recipients: complianceTeam,
          variables: {
            controlLink: `${process.env.APP_URL}/controls/${data.controlId}`,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateControlAssigned(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify new assignee
    if (data.assigneeId || data.assigneeEmail) {
      const assignee = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_ASSIGNED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.assigneeId || 'unknown',
          email: assignee?.email || data.assigneeEmail,
          name: assignee?.name,
        }],
        variables: {
          assignedBy: data.metadata?.assignedBy,
          dueDate: data.dueDate,
          instructions: data.metadata?.instructions || 'Please review the control requirements and begin implementation',
        },
      });

      // SMS notification if urgent
      if (data.dueDate && this.calculateDaysUntilDue(data.dueDate) <= 3) {
        const userPrefs = await this.getUserPreferences(data.assigneeId);
        if (userPrefs?.enableSmsAlerts && userPrefs?.phone) {
          decisions.push({
            shouldSend: true,
            templateCode: 'CONTROL_ASSIGNED_URGENT_SMS',
            channel: NotificationChannel.SMS,
            priority: 'urgent',
            recipients: [{
              id: data.assigneeId,
              phone: userPrefs.phone,
            }],
            variables: {
              controlName: data.controlName,
              dueDate: data.dueDate,
            },
          });
        }
      }
    }

    // Notify previous assignee if reassignment
    const previousAssigneeId = data.changes?.assignee?.old || data.metadata?.previousAssignee;
    if (previousAssigneeId) {
      const previousAssignee = await this.userDataService.getUserById(previousAssigneeId);
      if (previousAssignee) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_REASSIGNED_PREVIOUS',
          channel: NotificationChannel.IN_APP,
          priority: 'low',
          recipients: [{
            id: previousAssigneeId,
            userId: previousAssigneeId,
          }],
          variables: {
            newAssignee: data.assigneeId ? 
              (await this.userDataService.getUserById(data.assigneeId))?.name : 
              data.assigneeEmail,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateImplementationCompleted(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify control owner
    if (data.ownerId || data.ownerEmail) {
      const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_IMPLEMENTATION_COMPLETED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.ownerId || 'unknown',
          email: owner?.email || data.ownerEmail,
          name: owner?.name,
        }],
        variables: {
          completedBy: data.assigneeId ? 
            (await this.userDataService.getUserById(data.assigneeId))?.name :
            data.assigneeEmail,
          completionDate: data.completionDate || context.timestamp,
          nextStep: 'Control is ready for testing',
        },
      });
    }

    // Notify testing team
    const testingTeam = await this.getTestingTeam(data.organizationId);
    if (testingTeam.length > 0) {
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_READY_FOR_TESTING',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: testingTeam,
        variables: {
          testingDeadline: this.calculateTestingDeadline(data.dueDate),
          testingUrl: `${process.env.APP_URL}/controls/${data.controlId}/test`,
        },
      });
    }

    // Teams notification for visibility
    const orgSettings = await this.getOrganizationSettings(data.organizationId);
    if (orgSettings?.metadata?.teamsWebhookUrl) {
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_IMPLEMENTATION_TEAMS',
        channel: NotificationChannel.TEAMS,
        priority: 'low',
        recipients: [{
          id: 'teams',
          webhookUrl: orgSettings.metadata.teamsWebhookUrl,
        }],
        variables: {},
      });
    }

    return decisions;
  }

  private async evaluateTestFailed(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Urgent notification to assignee
    if (data.assigneeId || data.assigneeEmail) {
      const assignee = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_TEST_FAILED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.assigneeId || 'unknown',
          email: assignee?.email || data.assigneeEmail,
          name: assignee?.name,
        }],
        variables: {
          testResults: data.testResults,
          findings: data.findings,
          failureReason: data.metadata?.failureReason || 'Test criteria not met',
          actionRequired: 'Please review the test results and implement fixes',
        },
      });

      // Push notification for immediate attention
      if (data.assigneeId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'CONTROL_TEST_FAILED_PUSH',
          channel: NotificationChannel.PUSH,
          priority: 'urgent',
          recipients: [{
            id: data.assigneeId,
            userId: data.assigneeId,
          }],
          variables: {
            controlName: data.controlName,
          },
        });
      }
    }

    // Notify control owner
    if (data.ownerId && data.ownerId !== data.assigneeId) {
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_TEST_FAILED_OWNER',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.ownerId,
          email: (await this.userDataService.getUserById(data.ownerId))?.email,
        }],
        variables: {
          testResults: data.testResults,
          impact: this.assessTestFailureImpact(data),
        },
      });
    }

    // Alert compliance team if near deadline
    if (data.dueDate && this.calculateDaysUntilDue(data.dueDate) <= 7) {
      const complianceTeam = await this.getComplianceTeam(data.organizationId);
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_TEST_FAILED_DEADLINE_RISK',
        channel: NotificationChannel.SLACK,
        priority: 'urgent',
        recipients: complianceTeam,
        variables: {
          daysRemaining: this.calculateDaysUntilDue(data.dueDate),
          controlLink: `${process.env.APP_URL}/controls/${data.controlId}`,
        },
      });
    }

    return decisions;
  }

  private async evaluateTestPassed(
    data: ControlEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Congratulate assignee
    if (data.assigneeId || data.assigneeEmail) {
      const assignee = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_TEST_PASSED',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.assigneeId || 'unknown',
          email: assignee?.email || data.assigneeEmail,
          name: assignee?.name,
        }],
        variables: {
          testResults: data.testResults,
          testScore: data.metadata?.testScore,
        },
      });
    }

    // Notify control owner
    if (data.ownerId || data.ownerEmail) {
      const owner = data.ownerId ? await this.userDataService.getUserById(data.ownerId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_TEST_PASSED_OWNER',
        channel: NotificationChannel.IN_APP,
        priority: 'medium',
        recipients: [{
          id: data.ownerId || 'unknown',
          userId: data.ownerId,
        }],
        variables: {
          controlCompliance: 'Control is now compliant',
        },
      });
    }

    // Update compliance dashboard
    const complianceTeam = await this.getComplianceTeam(data.organizationId);
    if (complianceTeam.length > 0) {
      decisions.push({
        shouldSend: true,
        templateCode: 'CONTROL_COMPLIANCE_ACHIEVED',
        channel: NotificationChannel.SLACK,
        priority: 'low',
        recipients: complianceTeam,
        variables: {
          framework: data.framework,
          controlsCompliant: data.metadata?.totalCompliantControls,
          controlsTotal: data.metadata?.totalControls,
        },
      });
    }

    return decisions;
  }

  private getStatusChangePriority(oldStatus: string, newStatus: string): string {
    if (newStatus === 'failed' || newStatus === 'critical') return 'urgent';
    if (newStatus === 'at_risk' || oldStatus === 'compliant' && newStatus !== 'compliant') return 'high';
    if (newStatus === 'compliant' || newStatus === 'implemented') return 'medium';
    return 'low';
  }

  private isCriticalStatusChange(oldStatus: string, newStatus: string): boolean {
    const criticalTransitions = [
      { from: 'compliant', to: 'non_compliant' },
      { from: 'implemented', to: 'failed' },
      { from: 'tested', to: 'failed' },
    ];

    return criticalTransitions.some(
      transition => transition.from === oldStatus && transition.to === newStatus
    );
  }

  private assessStatusChangeImpact(oldStatus: string, newStatus: string): string {
    if (oldStatus === 'compliant' && newStatus === 'non_compliant') {
      return 'High - Control is no longer compliant, immediate action required';
    }
    if (newStatus === 'failed') {
      return 'Critical - Control has failed, remediation needed urgently';
    }
    if (newStatus === 'at_risk') {
      return 'Medium - Control is at risk of non-compliance';
    }
    return 'Low - Routine status change';
  }

  private assessTestFailureImpact(data: ControlEventData): string {
    if (data.framework === 'SOC2' || data.framework === 'ISO27001') {
      return 'High - Affects compliance certification';
    }
    if (data.category === 'security' || data.category === 'privacy') {
      return 'Critical - Security or privacy control failure';
    }
    return 'Medium - Standard control test failure';
  }

  private calculateDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private calculateTestingDeadline(dueDate?: Date): string {
    const deadline = dueDate ? new Date(dueDate) : new Date();
    if (!dueDate) {
      deadline.setDate(deadline.getDate() + 14); // Default 14 days for testing
    }
    return deadline.toISOString();
  }

  private async getComplianceTeam(organizationId: string): Promise<any[]> {
    // Would typically query for users with compliance role
    return [];
  }

  private async getTestingTeam(organizationId: string): Promise<any[]> {
    // Would typically query for users with testing/QA role
    return [];
  }
}