import { Injectable, Logger } from '@nestjs/common';
import type { KafkaContext } from '@nestjs/microservices';
import { UserEventHandler } from './handlers/user-event.handler';
import { PolicyEventHandler } from './handlers/policy-event.handler';
import { ControlEventHandler } from './handlers/control-event.handler';
import { EvidenceEventHandler } from './handlers/evidence-event.handler';
import { AuditEventHandler } from './handlers/audit-event.handler';
import { WorkflowEventHandler } from './handlers/workflow-event.handler';
import { ReportEventHandler } from './handlers/report-event.handler';
import type { BaseEventHandler } from './base-event-handler';

@Injectable()
export class EventHandlerService {
  private readonly logger = new Logger(EventHandlerService.name);
  private readonly handlers: Map<string, BaseEventHandler>;

  constructor(
    private readonly userEventHandler: UserEventHandler,
    private readonly policyEventHandler: PolicyEventHandler,
    private readonly controlEventHandler: ControlEventHandler,
    private readonly evidenceEventHandler: EvidenceEventHandler,
    private readonly auditEventHandler: AuditEventHandler,
    private readonly workflowEventHandler: WorkflowEventHandler,
    private readonly reportEventHandler: ReportEventHandler,
  ) {
    this.handlers = new Map();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // User events
    this.registerHandler(['user.created', 'user.updated', 'user.deleted', 'user.role.changed'], this.userEventHandler);
    
    // Policy events
    this.registerHandler(['policy.created', 'policy.updated', 'policy.approved', 'policy.rejected', 'policy.published'], this.policyEventHandler);
    
    // Control events
    this.registerHandler(['control.status.changed', 'control.assigned', 'control.implementation.completed', 'control.test.failed', 'control.test.passed'], this.controlEventHandler);
    
    // Evidence events
    this.registerHandler(['evidence.uploaded', 'evidence.verified', 'evidence.rejected', 'evidence.expiring', 'evidence.expired'], this.evidenceEventHandler);
    
    // Audit events
    this.registerHandler(['audit.created', 'audit.started', 'audit.completed', 'audit.finding.created', 'audit.finding.resolved'], this.auditEventHandler);
    
    // Workflow events
    this.registerHandler(['workflow.started', 'workflow.step.completed', 'workflow.approval.required', 'workflow.approved', 'workflow.rejected', 'workflow.completed', 'workflow.failed'], this.workflowEventHandler);
    
    // Report events
    this.registerHandler(['report.generated', 'report.scheduled', 'report.failed'], this.reportEventHandler);
  }

  private registerHandler(eventTypes: string[], handler: BaseEventHandler): void {
    eventTypes.forEach((eventType) => {
      this.handlers.set(eventType, handler);
      this.logger.log(`Registered handler for event: ${eventType}`);
    });
  }

  async handleEvent(eventType: string, data: any, context?: KafkaContext): Promise<void> {
    const handler = this.handlers.get(eventType);
    
    if (!handler) {
      this.logger.warn(`No handler registered for event type: ${eventType}`);
      return;
    }

    try {
      // Add event metadata
      const enrichedData = {
        ...data,
        eventType,
        eventId: data.id || this.generateEventId(),
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Extract Kafka metadata if available
      if (context) {
        const message = context.getMessage();
        enrichedData.kafkaMetadata = {
          topic: context.getTopic(),
          partition: context.getPartition(),
          offset: message.offset,
          key: message.key?.toString(),
          timestamp: message.timestamp,
        };
      }

      await handler.handleEvent(enrichedData);
    } catch (error) {
      this.logger.error(
        `Error handling event ${eventType}: ${error.message}`,
        error.stack,
      );
      // Consider implementing dead letter queue here
      throw error;
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getHandlerStats(): Promise<any> {
    return {
      totalHandlers: this.handlers.size,
      registeredEvents: Array.from(this.handlers.keys()),
      handlers: Array.from(new Set(this.handlers.values())).map(handler => handler.constructor.name),
    };
  }
}