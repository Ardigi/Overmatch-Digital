import { Injectable, Logger } from '@nestjs/common';
import type { NotificationsService } from '../notifications/notifications.service';
import type { NotificationRulesService } from '../rules/notification-rules.service';
import type { UserDataService } from '../users/user-data.service';

export interface EventHandlerOptions {
  eventType: string;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface EventContext {
  eventId: string;
  eventType: string;
  organizationId: string;
  timestamp: Date;
  source: string;
  correlationId?: string;
}

export interface NotificationDecision {
  shouldSend: boolean;
  templateCode?: string;
  channel?: string;
  priority?: string;
  recipients?: any[];
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export abstract class BaseEventHandler<T = any> {
  protected readonly logger: Logger;

  constructor(
    protected readonly notificationsService: NotificationsService,
    protected readonly rulesService: NotificationRulesService,
    protected readonly userDataService: UserDataService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract getEventType(): string;

  abstract extractEventData(payload: any): T;

  abstract evaluateNotificationRules(
    data: T,
    context: EventContext,
  ): Promise<NotificationDecision[]>;

  abstract enrichNotificationData(
    decision: NotificationDecision,
    data: T,
    context: EventContext,
  ): Promise<NotificationDecision>;

  async handleEvent(payload: any): Promise<void> {
    const startTime = Date.now();
    const context = this.buildEventContext(payload);

    try {
      this.logger.log(`Processing event ${context.eventType} - ${context.eventId}`);

      // Extract event data
      const data = this.extractEventData(payload);

      // Evaluate notification rules
      const decisions = await this.evaluateNotificationRules(data, context);

      // Process each notification decision
      for (const decision of decisions) {
        if (!decision.shouldSend) {
          continue;
        }

        // Enrich notification data
        const enrichedDecision = await this.enrichNotificationData(
          decision,
          data,
          context,
        );

        // Create notifications
        await this.createNotifications(enrichedDecision, context);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Successfully processed event ${context.eventType} in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process event ${context.eventType}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  protected buildEventContext(payload: any): EventContext {
    return {
      eventId: payload.id || payload.eventId || this.generateEventId(),
      eventType: payload.type || payload.eventType || this.getEventType(),
      organizationId: payload.organizationId || payload.orgId,
      timestamp: new Date(payload.timestamp || Date.now()),
      source: payload.source || payload.service || 'unknown',
      correlationId: payload.correlationId || payload.traceId,
    };
  }

  protected async createNotifications(
    decision: NotificationDecision,
    context: EventContext,
  ): Promise<void> {
    const { recipients, templateCode, channel, priority, variables, metadata } = decision;

    if (!recipients || recipients.length === 0) {
      this.logger.warn('No recipients found for notification');
      return;
    }

    // Create notifications for each recipient
    const notifications = await Promise.all(
      recipients.map(async (recipient) => {
        return this.notificationsService.createFromTemplate(
          context.organizationId,
          {
            templateCode,
            channel,
            recipient,
            variables: {
              ...variables,
              eventType: context.eventType,
              eventId: context.eventId,
            },
            priority: priority || 'medium',
            metadata: {
              ...metadata,
              eventContext: context,
            },
            tags: [`event:${context.eventType}`, 'auto-generated'],
          },
          'system',
        );
      }),
    );

    this.logger.log(
      `Created ${notifications.length} notifications for event ${context.eventType}`,
    );
  }

  protected generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async getUserPreferences(userId: string): Promise<any> {
    try {
      return await this.userDataService.getUserPreferences(userId);
    } catch (error) {
      this.logger.warn(`Failed to fetch preferences for user ${userId}`);
      return null;
    }
  }

  protected async getOrganizationSettings(organizationId: string): Promise<any> {
    try {
      return await this.userDataService.getOrganizationSettings(organizationId);
    } catch (error) {
      this.logger.warn(`Failed to fetch settings for organization ${organizationId}`);
      return null;
    }
  }

  protected shouldThrottle(
    userId: string,
    eventType: string,
    threshold: number = 5,
  ): boolean {
    // Implement throttling logic to prevent notification spam
    // This would typically check Redis for recent notification counts
    return false; // Placeholder
  }

  protected async validateRecipient(recipient: any): Promise<boolean> {
    if (!recipient) return false;
    
    // Check if recipient has valid contact information
    if (recipient.email || recipient.phone || recipient.userId) {
      return true;
    }
    
    return false;
  }
}