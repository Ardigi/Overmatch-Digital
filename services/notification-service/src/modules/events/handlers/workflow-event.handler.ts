import { Injectable } from '@nestjs/common';
import { BaseEventHandler, type EventContext, type NotificationDecision } from '../base-event-handler';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationRulesService } from '../../rules/notification-rules.service';
import type { UserDataService } from '../../users/user-data.service';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export interface WorkflowEventData {
  workflowId: string;
  workflowName: string;
  workflowType?: string;
  description?: string;
  status?: string;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  initiatorId?: string;
  initiatorEmail?: string;
  assigneeId?: string;
  assigneeEmail?: string;
  approverId?: string;
  approverEmail?: string;
  organizationId: string;
  action?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  startDate?: Date;
  dueDate?: Date;
  completionDate?: Date;
  approvalRequired?: boolean;
  approvalLevel?: number;
  escalationPath?: string[];
  failureReason?: string;
}

@Injectable()
export class WorkflowEventHandler extends BaseEventHandler<WorkflowEventData> {
  constructor(
    notificationsService: NotificationsService,
    rulesService: NotificationRulesService,
    userDataService: UserDataService,
  ) {
    super(notificationsService, rulesService, userDataService);
  }

  getEventType(): string {
    return 'workflow';
  }

  extractEventData(payload: any): WorkflowEventData {
    return {
      workflowId: payload.workflowId || payload.id,
      workflowName: payload.workflowName || payload.name,
      workflowType: payload.workflowType || payload.type,
      description: payload.description,
      status: payload.status,
      currentStep: payload.currentStep || payload.step,
      totalSteps: payload.totalSteps,
      completedSteps: payload.completedSteps || payload.stepsCompleted,
      initiatorId: payload.initiatorId || payload.initiator,
      initiatorEmail: payload.initiatorEmail,
      assigneeId: payload.assigneeId || payload.assignee,
      assigneeEmail: payload.assigneeEmail,
      approverId: payload.approverId || payload.approver,
      approverEmail: payload.approverEmail,
      organizationId: payload.organizationId || payload.orgId,
      action: payload.action || payload.eventType?.split('.')[1],
      changes: payload.changes || payload.updates,
      metadata: payload.metadata || {},
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      completionDate: payload.completionDate ? new Date(payload.completionDate) : undefined,
      approvalRequired: payload.approvalRequired,
      approvalLevel: payload.approvalLevel,
      escalationPath: payload.escalationPath || [],
      failureReason: payload.failureReason,
    };
  }

  async evaluateNotificationRules(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    switch (context.eventType) {
      case 'workflow.started':
        decisions.push(...(await this.evaluateWorkflowStarted(data, context)));
        break;
      case 'workflow.step.completed':
        decisions.push(...(await this.evaluateStepCompleted(data, context)));
        break;
      case 'workflow.approval.required':
        decisions.push(...(await this.evaluateApprovalRequired(data, context)));
        break;
      case 'workflow.approved':
        decisions.push(...(await this.evaluateWorkflowApproved(data, context)));
        break;
      case 'workflow.rejected':
        decisions.push(...(await this.evaluateWorkflowRejected(data, context)));
        break;
      case 'workflow.completed':
        decisions.push(...(await this.evaluateWorkflowCompleted(data, context)));
        break;
      case 'workflow.failed':
        decisions.push(...(await this.evaluateWorkflowFailed(data, context)));
        break;
    }

    return decisions;
  }

  async enrichNotificationData(
    decision: NotificationDecision,
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision> {
    const initiatorData = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
    const assigneeData = data.assigneeId ? await this.userDataService.getUserById(data.assigneeId) : null;
    const approverData = data.approverId ? await this.userDataService.getUserById(data.approverId) : null;
    const orgData = await this.getOrganizationSettings(data.organizationId);

    return {
      ...decision,
      variables: {
        ...decision.variables,
        workflowName: data.workflowName,
        workflowType: data.workflowType,
        currentStep: data.currentStep,
        progress: data.totalSteps ? `${data.completedSteps}/${data.totalSteps}` : 'N/A',
        progressPercentage: data.totalSteps ? Math.round((data.completedSteps / data.totalSteps) * 100) : 0,
        initiatorName: initiatorData?.name || data.initiatorEmail || 'Workflow Initiator',
        assigneeName: assigneeData?.name || data.assigneeEmail || 'Assignee',
        approverName: approverData?.name || data.approverEmail || 'Approver',
        organizationName: orgData?.name || 'Your Organization',
        workflowUrl: `${process.env.APP_URL}/workflows/${data.workflowId}`,
        dueDate: data.dueDate?.toLocaleDateString(),
        daysUntilDue: data.dueDate ? this.calculateDaysUntilDue(data.dueDate) : null,
      },
    };
  }

  private async evaluateWorkflowStarted(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify initiator of workflow start
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_STARTED_INITIATOR',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.initiatorId || 'unknown',
          email: initiator?.email || data.initiatorEmail,
          name: initiator?.name,
        }],
        variables: {
          workflowTracking: `Workflow ID: ${data.workflowId}`,
          estimatedCompletion: this.calculateEstimatedCompletion(data),
        },
      });
    }

    // Notify first assignee if different from initiator
    if (data.assigneeId && data.assigneeId !== data.initiatorId) {
      const assignee = await this.userDataService.getUserById(data.assigneeId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_TASK_ASSIGNED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.assigneeId,
          email: assignee?.email || data.assigneeEmail,
          name: assignee?.name,
        }],
        variables: {
          taskDescription: data.metadata?.currentTaskDescription || 'Please complete the assigned task',
          taskUrl: `${process.env.APP_URL}/workflows/${data.workflowId}/tasks`,
        },
      });

      // In-app notification for immediate visibility
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_TASK_ASSIGNED_INAPP',
        channel: NotificationChannel.IN_APP,
        priority: 'high',
        recipients: [{
          id: data.assigneeId,
          userId: data.assigneeId,
        }],
        variables: {
          actionUrl: `/workflows/${data.workflowId}/tasks`,
        },
      });
    }

    return decisions;
  }

  private async evaluateStepCompleted(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify initiator of progress
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_PROGRESS_UPDATE',
        channel: NotificationChannel.IN_APP,
        priority: 'low',
        recipients: [{
          id: data.initiatorId || 'unknown',
          userId: data.initiatorId,
        }],
        variables: {
          stepCompleted: data.currentStep,
          nextStep: data.metadata?.nextStep,
          progressBar: this.generateProgressBar(data.completedSteps, data.totalSteps),
        },
      });
    }

    // If next step has different assignee, notify them
    const nextAssigneeId = data.metadata?.nextAssignee;
    if (nextAssigneeId && nextAssigneeId !== data.assigneeId) {
      const nextAssignee = await this.userDataService.getUserById(nextAssigneeId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_NEXT_TASK',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: nextAssigneeId,
          email: nextAssignee?.email,
          name: nextAssignee?.name,
        }],
        variables: {
          previousStep: data.currentStep,
          yourTask: data.metadata?.nextTaskDescription,
          deadline: data.metadata?.nextTaskDeadline,
        },
      });
    }

    // Milestone notifications
    if (this.isMilestoneStep(data.completedSteps, data.totalSteps)) {
      const stakeholders = await this.getWorkflowStakeholders(data.workflowId, data.organizationId);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_MILESTONE_REACHED',
        channel: NotificationChannel.SLACK,
        priority: 'medium',
        recipients: stakeholders,
        variables: {
          milestone: `${data.completedSteps} of ${data.totalSteps} steps completed`,
        },
      });
    }

    return decisions;
  }

  private async evaluateApprovalRequired(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Primary approver notification
    if (data.approverId || data.approverEmail) {
      const approver = data.approverId ? await this.userDataService.getUserById(data.approverId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_APPROVAL_REQUEST',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.approverId || 'unknown',
          email: approver?.email || data.approverEmail,
          name: approver?.name,
        }],
        variables: {
          requestedBy: data.initiatorId ? 
            (await this.userDataService.getUserById(data.initiatorId))?.name :
            data.initiatorEmail,
          approvalDeadline: this.calculateApprovalDeadline(data.dueDate),
          approvalUrl: `${process.env.APP_URL}/workflows/${data.workflowId}/approve`,
          workflowSummary: data.metadata?.summary,
        },
      });

      // Push notification for urgent approvals
      if (data.metadata?.urgent || this.isUrgentApproval(data.dueDate)) {
        decisions.push({
          shouldSend: true,
          templateCode: 'URGENT_APPROVAL_PUSH',
          channel: NotificationChannel.PUSH,
          priority: 'urgent',
          recipients: [{
            id: data.approverId || 'unknown',
            userId: data.approverId,
          }],
          variables: {
            workflowName: data.workflowName,
          },
        });
      }

      // SMS for critical approvals
      if (data.metadata?.critical) {
        const approverPrefs = await this.getUserPreferences(data.approverId);
        if (approverPrefs?.enableSmsAlerts && approverPrefs?.phone) {
          decisions.push({
            shouldSend: true,
            templateCode: 'CRITICAL_APPROVAL_SMS',
            channel: NotificationChannel.SMS,
            priority: 'urgent',
            recipients: [{
              id: data.approverId,
              phone: approverPrefs.phone,
            }],
            variables: {
              workflowName: data.workflowName,
              deadline: data.dueDate?.toLocaleTimeString(),
            },
          });
        }
      }
    }

    // Escalation path notifications
    if (data.escalationPath && data.escalationPath.length > 0) {
      const escalationUsers = await this.userDataService.getUsersByIds(data.escalationPath);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_ESCALATION_NOTICE',
        channel: NotificationChannel.IN_APP,
        priority: 'medium',
        recipients: escalationUsers.map(user => ({
          id: user.id,
          userId: user.id,
        })),
        variables: {
          escalationTime: data.metadata?.escalationTime || '24 hours',
        },
      });
    }

    return decisions;
  }

  private async evaluateWorkflowApproved(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify initiator of approval
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_APPROVED',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.initiatorId || 'unknown',
          email: initiator?.email || data.initiatorEmail,
          name: initiator?.name,
        }],
        variables: {
          approvedBy: data.approverId ?
            (await this.userDataService.getUserById(data.approverId))?.name :
            data.approverEmail,
          approvalDate: context.timestamp,
          nextSteps: data.metadata?.nextSteps || 'Workflow will continue to next step',
        },
      });
    }

    // Notify next assignee if workflow continues
    if (data.metadata?.nextAssignee) {
      const nextAssignee = await this.userDataService.getUserById(data.metadata.nextAssignee);
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_APPROVED_CONTINUE',
        channel: NotificationChannel.EMAIL,
        priority: 'high',
        recipients: [{
          id: data.metadata.nextAssignee,
          email: nextAssignee?.email,
          name: nextAssignee?.name,
        }],
        variables: {
          approvalReceived: true,
          yourTask: data.metadata?.nextTaskDescription,
        },
      });
    }

    return decisions;
  }

  private async evaluateWorkflowRejected(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify initiator of rejection
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_REJECTED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.initiatorId || 'unknown',
          email: initiator?.email || data.initiatorEmail,
          name: initiator?.name,
        }],
        variables: {
          rejectedBy: data.approverId ?
            (await this.userDataService.getUserById(data.approverId))?.name :
            data.approverEmail,
          rejectionReason: data.metadata?.rejectionReason || 'Approval criteria not met',
          rejectionDate: context.timestamp,
          canResubmit: data.metadata?.canResubmit !== false,
        },
      });

      // In-app notification for immediate visibility
      if (data.initiatorId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'WORKFLOW_REJECTED_INAPP',
          channel: NotificationChannel.IN_APP,
          priority: 'urgent',
          recipients: [{
            id: data.initiatorId,
            userId: data.initiatorId,
          }],
          variables: {
            actionUrl: `/workflows/${data.workflowId}`,
          },
        });
      }
    }

    // Notify current assignee if different from initiator
    if (data.assigneeId && data.assigneeId !== data.initiatorId) {
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_REJECTED_ASSIGNEE',
        channel: NotificationChannel.IN_APP,
        priority: 'high',
        recipients: [{
          id: data.assigneeId,
          userId: data.assigneeId,
        }],
        variables: {
          workflowStopped: true,
        },
      });
    }

    return decisions;
  }

  private async evaluateWorkflowCompleted(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Notify initiator of completion
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_COMPLETED',
        channel: NotificationChannel.EMAIL,
        priority: 'medium',
        recipients: [{
          id: data.initiatorId || 'unknown',
          email: initiator?.email || data.initiatorEmail,
          name: initiator?.name,
        }],
        variables: {
          completionDate: data.completionDate || context.timestamp,
          totalDuration: this.calculateDuration(data.startDate, data.completionDate),
          resultsUrl: `${process.env.APP_URL}/workflows/${data.workflowId}/results`,
        },
      });
    }

    // Notify all participants
    const participants = await this.getWorkflowParticipants(data.workflowId, data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'WORKFLOW_COMPLETED_PARTICIPANT',
      channel: NotificationChannel.IN_APP,
      priority: 'low',
      recipients: participants.map(p => ({
        id: p.id,
        userId: p.id,
      })),
      variables: {
        workflowSummary: data.metadata?.summary,
      },
    });

    // Success announcement if configured
    if (data.metadata?.announceCompletion) {
      const orgSettings = await this.getOrganizationSettings(data.organizationId);
      if (orgSettings?.metadata?.slackChannelId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'WORKFLOW_SUCCESS_SLACK',
          channel: NotificationChannel.SLACK,
          priority: 'low',
          recipients: [{
            id: 'slack',
            channelId: orgSettings.metadata.slackChannelId,
          }],
          variables: {
            achievement: data.metadata?.achievement,
          },
        });
      }
    }

    return decisions;
  }

  private async evaluateWorkflowFailed(
    data: WorkflowEventData,
    context: EventContext,
  ): Promise<NotificationDecision[]> {
    const decisions: NotificationDecision[] = [];

    // Urgent notification to initiator
    if (data.initiatorId || data.initiatorEmail) {
      const initiator = data.initiatorId ? await this.userDataService.getUserById(data.initiatorId) : null;
      
      decisions.push({
        shouldSend: true,
        templateCode: 'WORKFLOW_FAILED',
        channel: NotificationChannel.EMAIL,
        priority: 'urgent',
        recipients: [{
          id: data.initiatorId || 'unknown',
          email: initiator?.email || data.initiatorEmail,
          name: initiator?.name,
        }],
        variables: {
          failureReason: data.failureReason || 'Workflow encountered an error',
          failedStep: data.currentStep,
          supportUrl: `${process.env.APP_URL}/support`,
        },
      });

      // Push notification for immediate attention
      if (data.initiatorId) {
        decisions.push({
          shouldSend: true,
          templateCode: 'WORKFLOW_FAILED_PUSH',
          channel: NotificationChannel.PUSH,
          priority: 'urgent',
          recipients: [{
            id: data.initiatorId,
            userId: data.initiatorId,
          }],
          variables: {
            workflowName: data.workflowName,
          },
        });
      }
    }

    // Alert workflow administrators
    const admins = await this.getWorkflowAdmins(data.organizationId);
    
    decisions.push({
      shouldSend: true,
      templateCode: 'WORKFLOW_FAILED_ADMIN',
      channel: NotificationChannel.SLACK,
      priority: 'urgent',
      recipients: admins,
      variables: {
        workflowId: data.workflowId,
        errorDetails: data.metadata?.errorDetails,
        diagnosticsUrl: `${process.env.APP_URL}/workflows/${data.workflowId}/diagnostics`,
      },
    });

    return decisions;
  }

  private calculateDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private calculateEstimatedCompletion(data: WorkflowEventData): string {
    if (data.dueDate) {
      return data.dueDate.toLocaleDateString();
    }
    const estimate = new Date();
    estimate.setDate(estimate.getDate() + (data.totalSteps || 7));
    return estimate.toLocaleDateString();
  }

  private calculateApprovalDeadline(dueDate?: Date): string {
    if (dueDate) {
      return dueDate.toISOString();
    }
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);
    return deadline.toISOString();
  }

  private calculateDuration(startDate?: Date, endDate?: Date): string {
    if (!startDate || !endDate) return 'N/A';
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days, ${hours} hours`;
  }

  private generateProgressBar(completed: number, total: number): string {
    if (!total) return '[----------]';
    const percentage = Math.round((completed / total) * 10);
    const filled = '='.repeat(percentage);
    const empty = '-'.repeat(10 - percentage);
    return `[${filled}${empty}] ${completed}/${total}`;
  }

  private isMilestoneStep(completed: number, total: number): boolean {
    if (!total) return false;
    const percentage = (completed / total) * 100;
    return percentage === 25 || percentage === 50 || percentage === 75;
  }

  private isUrgentApproval(dueDate?: Date): boolean {
    if (!dueDate) return false;
    const hoursUntilDue = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilDue <= 4;
  }

  private async getWorkflowStakeholders(workflowId: string, organizationId: string): Promise<any[]> {
    // Would query for workflow stakeholders
    return [];
  }

  private async getWorkflowParticipants(workflowId: string, organizationId: string): Promise<any[]> {
    // Would query for all workflow participants
    return [];
  }

  private async getWorkflowAdmins(organizationId: string): Promise<any[]> {
    // Would query for workflow administrators
    return [];
  }
}