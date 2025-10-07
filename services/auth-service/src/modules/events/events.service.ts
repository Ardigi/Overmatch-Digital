import { Injectable, Logger } from '@nestjs/common';
import { AuthEventType, KafkaService } from './kafka.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly kafkaService: KafkaService) {}
  async publishEvent(eventName: string, payload: any): Promise<void> {
    try {
      // Map event names to AuthEventType enum values
      const eventTypeMap: Record<string, AuthEventType> = {
        'user.created': AuthEventType.USER_CREATED,
        'user.updated': AuthEventType.USER_UPDATED,
        'user.deleted': AuthEventType.USER_DELETED,
        'user.invited': AuthEventType.USER_INVITED,
        'user.passwordChanged': AuthEventType.PASSWORD_CHANGED,
        'auth.failed': AuthEventType.USER_LOGIN_FAILED,
        'password.reset.requested': AuthEventType.PASSWORD_RESET_REQUESTED,
        'password.reset.completed': AuthEventType.PASSWORD_RESET_COMPLETED,
        'password.changed': AuthEventType.PASSWORD_CHANGED,
        'email.verification.requested': AuthEventType.EMAIL_VERIFICATION_REQUESTED,
        'email.verified': AuthEventType.EMAIL_VERIFIED,
      };

      const eventType = eventTypeMap[eventName] || eventName;

      // Publish auth event using KafkaService
      await this.kafkaService.publishAuthEvent({
        eventType,
        userId: payload.userId || payload.user?.id,
        organizationId: payload.organizationId || payload.user?.organizationId,
        timestamp: new Date(),
        metadata: payload,
      });

      // If it's a notification-worthy event, also request notification
      if (this.shouldNotify(eventName)) {
        await this.requestNotification(eventName, payload);
      }

      this.logger.log(`Published event: ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${eventName}`, error);
      // Don't throw - we don't want event publishing failures to break the flow
    }
  }

  private shouldNotify(eventName: string): boolean {
    const notificationEvents = [
      'user.invited',
      'password.reset.requested',
      'email.verification.requested',
      'user.passwordChanged',
    ];
    return notificationEvents.includes(eventName);
  }

  private async requestNotification(eventName: string, payload: any): Promise<void> {
    const notificationTemplates: Record<string, string> = {
      'user.invited': 'user-invitation',
      'password.reset.requested': 'password-reset',
      'email.verification.requested': 'email-verification',
      'user.passwordChanged': 'password-changed',
    };

    if (!notificationTemplates[eventName]) return;

    await this.kafkaService.requestNotification({
      userId: payload.userId || payload.user?.id,
      organizationId: payload.organizationId || payload.user?.organizationId,
      type: eventName,
      channel: 'email',
      template: notificationTemplates[eventName],
      data: {
        ...payload,
        email: payload.email || payload.user?.email,
        firstName: payload.firstName || payload.user?.profile?.firstName,
        resetUrl: payload.resetUrl,
        verificationUrl: payload.verificationUrl,
      },
      priority: 'high',
    });
  }
}
