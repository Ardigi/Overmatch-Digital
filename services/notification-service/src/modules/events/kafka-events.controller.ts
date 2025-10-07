import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { EventHandlerService } from './event-handler.service';

@Controller()
export class KafkaEventsController {
  private readonly logger = new Logger(KafkaEventsController.name);

  constructor(private readonly eventHandlerService: EventHandlerService) {}

  // User Events
  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received user.created event');
    await this.eventHandlerService.handleEvent('user.created', data, context);
  }

  @EventPattern('user.updated')
  async handleUserUpdated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received user.updated event');
    await this.eventHandlerService.handleEvent('user.updated', data, context);
  }

  @EventPattern('user.deleted')
  async handleUserDeleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received user.deleted event');
    await this.eventHandlerService.handleEvent('user.deleted', data, context);
  }

  @EventPattern('user.role.changed')
  async handleUserRoleChanged(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received user.role.changed event');
    await this.eventHandlerService.handleEvent('user.role.changed', data, context);
  }

  // Policy Events
  @EventPattern('policy.created')
  async handlePolicyCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received policy.created event');
    await this.eventHandlerService.handleEvent('policy.created', data, context);
  }

  @EventPattern('policy.updated')
  async handlePolicyUpdated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received policy.updated event');
    await this.eventHandlerService.handleEvent('policy.updated', data, context);
  }

  @EventPattern('policy.approved')
  async handlePolicyApproved(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received policy.approved event');
    await this.eventHandlerService.handleEvent('policy.approved', data, context);
  }

  @EventPattern('policy.rejected')
  async handlePolicyRejected(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received policy.rejected event');
    await this.eventHandlerService.handleEvent('policy.rejected', data, context);
  }

  @EventPattern('policy.published')
  async handlePolicyPublished(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received policy.published event');
    await this.eventHandlerService.handleEvent('policy.published', data, context);
  }

  // Control Events
  @EventPattern('control.status.changed')
  async handleControlStatusChanged(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received control.status.changed event');
    await this.eventHandlerService.handleEvent('control.status.changed', data, context);
  }

  @EventPattern('control.assigned')
  async handleControlAssigned(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received control.assigned event');
    await this.eventHandlerService.handleEvent('control.assigned', data, context);
  }

  @EventPattern('control.implementation.completed')
  async handleControlImplementationCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received control.implementation.completed event');
    await this.eventHandlerService.handleEvent('control.implementation.completed', data, context);
  }

  @EventPattern('control.test.failed')
  async handleControlTestFailed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received control.test.failed event');
    await this.eventHandlerService.handleEvent('control.test.failed', data, context);
  }

  @EventPattern('control.test.passed')
  async handleControlTestPassed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received control.test.passed event');
    await this.eventHandlerService.handleEvent('control.test.passed', data, context);
  }

  // Evidence Events
  @EventPattern('evidence.uploaded')
  async handleEvidenceUploaded(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received evidence.uploaded event');
    await this.eventHandlerService.handleEvent('evidence.uploaded', data, context);
  }

  @EventPattern('evidence.verified')
  async handleEvidenceVerified(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received evidence.verified event');
    await this.eventHandlerService.handleEvent('evidence.verified', data, context);
  }

  @EventPattern('evidence.rejected')
  async handleEvidenceRejected(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received evidence.rejected event');
    await this.eventHandlerService.handleEvent('evidence.rejected', data, context);
  }

  @EventPattern('evidence.expiring')
  async handleEvidenceExpiring(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received evidence.expiring event');
    await this.eventHandlerService.handleEvent('evidence.expiring', data, context);
  }

  @EventPattern('evidence.expired')
  async handleEvidenceExpired(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received evidence.expired event');
    await this.eventHandlerService.handleEvent('evidence.expired', data, context);
  }

  // Audit Events
  @EventPattern('audit.created')
  async handleAuditCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received audit.created event');
    await this.eventHandlerService.handleEvent('audit.created', data, context);
  }

  @EventPattern('audit.started')
  async handleAuditStarted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received audit.started event');
    await this.eventHandlerService.handleEvent('audit.started', data, context);
  }

  @EventPattern('audit.completed')
  async handleAuditCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received audit.completed event');
    await this.eventHandlerService.handleEvent('audit.completed', data, context);
  }

  @EventPattern('audit.finding.created')
  async handleAuditFindingCreated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received audit.finding.created event');
    await this.eventHandlerService.handleEvent('audit.finding.created', data, context);
  }

  @EventPattern('audit.finding.resolved')
  async handleAuditFindingResolved(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received audit.finding.resolved event');
    await this.eventHandlerService.handleEvent('audit.finding.resolved', data, context);
  }

  // Workflow Events
  @EventPattern('workflow.started')
  async handleWorkflowStarted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.started event');
    await this.eventHandlerService.handleEvent('workflow.started', data, context);
  }

  @EventPattern('workflow.step.completed')
  async handleWorkflowStepCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.step.completed event');
    await this.eventHandlerService.handleEvent('workflow.step.completed', data, context);
  }

  @EventPattern('workflow.approval.required')
  async handleWorkflowApprovalRequired(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.approval.required event');
    await this.eventHandlerService.handleEvent('workflow.approval.required', data, context);
  }

  @EventPattern('workflow.approved')
  async handleWorkflowApproved(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.approved event');
    await this.eventHandlerService.handleEvent('workflow.approved', data, context);
  }

  @EventPattern('workflow.rejected')
  async handleWorkflowRejected(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.rejected event');
    await this.eventHandlerService.handleEvent('workflow.rejected', data, context);
  }

  @EventPattern('workflow.completed')
  async handleWorkflowCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.completed event');
    await this.eventHandlerService.handleEvent('workflow.completed', data, context);
  }

  @EventPattern('workflow.failed')
  async handleWorkflowFailed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received workflow.failed event');
    await this.eventHandlerService.handleEvent('workflow.failed', data, context);
  }

  // Report Events
  @EventPattern('report.generated')
  async handleReportGenerated(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received report.generated event');
    await this.eventHandlerService.handleEvent('report.generated', data, context);
  }

  @EventPattern('report.scheduled')
  async handleReportScheduled(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received report.scheduled event');
    await this.eventHandlerService.handleEvent('report.scheduled', data, context);
  }

  @EventPattern('report.failed')
  async handleReportFailed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received report.failed event');
    await this.eventHandlerService.handleEvent('report.failed', data, context);
  }

  // Integration Events
  @EventPattern('integration.connected')
  async handleIntegrationConnected(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received integration.connected event');
    await this.eventHandlerService.handleEvent('integration.connected', data, context);
  }

  @EventPattern('integration.disconnected')
  async handleIntegrationDisconnected(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received integration.disconnected event');
    await this.eventHandlerService.handleEvent('integration.disconnected', data, context);
  }

  @EventPattern('integration.sync.completed')
  async handleIntegrationSyncCompleted(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received integration.sync.completed event');
    await this.eventHandlerService.handleEvent('integration.sync.completed', data, context);
  }

  @EventPattern('integration.sync.failed')
  async handleIntegrationSyncFailed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received integration.sync.failed event');
    await this.eventHandlerService.handleEvent('integration.sync.failed', data, context);
  }

  // Compliance Events
  @EventPattern('compliance.deadline.approaching')
  async handleComplianceDeadlineApproaching(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received compliance.deadline.approaching event');
    await this.eventHandlerService.handleEvent('compliance.deadline.approaching', data, context);
  }

  @EventPattern('compliance.deadline.missed')
  async handleComplianceDeadlineMissed(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received compliance.deadline.missed event');
    await this.eventHandlerService.handleEvent('compliance.deadline.missed', data, context);
  }

  @EventPattern('compliance.status.changed')
  async handleComplianceStatusChanged(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received compliance.status.changed event');
    await this.eventHandlerService.handleEvent('compliance.status.changed', data, context);
  }

  // Generic message pattern for testing
  @MessagePattern('notification.test')
  async handleTestMessage(@Payload() data: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received test message', data);
    return { success: true, message: 'Test notification received' };
  }
}