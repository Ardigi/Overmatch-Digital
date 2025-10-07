import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  DeliveryStatus,
  type NotificationProvider,
  type NotificationProviderType,
  type ProviderConfig,
  type SendResult,
} from '../interfaces/notification-provider.interface';

export interface PushConfig extends ProviderConfig {
  provider: 'firebase' | 'onesignal';
  firebase?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    databaseURL?: string;
  };
  oneSignal?: {
    appId: string;
    apiKey: string;
  };
}

export interface PushContent {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: number;
  sound?: string;
  data?: Record<string, string>;
  actions?: PushAction[];
  priority?: 'normal' | 'high';
  ttl?: number; // Time to live in seconds
  collapseKey?: string;
  mutableContent?: boolean;
  contentAvailable?: boolean;
}

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushRecipient {
  deviceTokens?: string[];
  userId?: string;
  topic?: string;
  condition?: string;
  platform?: 'ios' | 'android' | 'web';
}

@Injectable()
export class PushProviderService implements NotificationProvider {
  private readonly logger = new Logger(PushProviderService.name);
  private firebaseApp: admin.app.App;
  private config: PushConfig;

  constructor(private readonly configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const provider = this.configService.get<string>('PUSH_PROVIDER', 'firebase');

    if (provider === 'firebase') {
      this.initializeFirebase();
    } else if (provider === 'onesignal') {
      this.initializeOneSignal();
    }
  }

  private initializeFirebase(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const databaseURL = this.configService.get<string>('FIREBASE_DATABASE_URL');

    if (projectId && privateKey && clientEmail) {
      try {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
          databaseURL,
        });

        this.config = {
          provider: 'firebase',
          firebase: {
            projectId,
            privateKey,
            clientEmail,
            databaseURL,
          },
        };

        this.logger.log('Firebase push provider configured');
      } catch (error) {
        this.logger.error('Failed to initialize Firebase:', error);
      }
    } else {
      this.logger.warn('Firebase credentials not configured');
    }
  }

  private initializeOneSignal(): void {
    const appId = this.configService.get<string>('ONESIGNAL_APP_ID');
    const apiKey = this.configService.get<string>('ONESIGNAL_API_KEY');

    if (appId && apiKey) {
      this.config = {
        provider: 'onesignal',
        oneSignal: {
          appId,
          apiKey,
        },
      };

      this.logger.log('OneSignal push provider configured');
    } else {
      this.logger.warn('OneSignal credentials not configured');
    }
  }

  getType(): NotificationProviderType {
    return 'push';
  }

  async send(recipient: PushRecipient, content: PushContent, options?: any): Promise<SendResult> {
    if (this.config.provider === 'firebase') {
      return this.sendFirebasePush(recipient, content, options);
    } else if (this.config.provider === 'onesignal') {
      return this.sendOneSignalPush(recipient, content, options);
    }

    throw new Error('Push provider not configured');
  }

  private async sendFirebasePush(
    recipient: PushRecipient,
    content: PushContent,
    options?: any
  ): Promise<SendResult> {
    if (!this.firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    try {
      const baseMessage = {
        notification: {
          title: content.title,
          body: content.body,
          imageUrl: content.image,
        },
        data: content.data || {},
        android: {
          priority: (content.priority === 'high' ? 'high' : 'normal') as 'high' | 'normal',
          ttl: content.ttl ? content.ttl * 1000 : undefined, // Convert to milliseconds
          collapseKey: content.collapseKey,
          notification: {
            icon: content.icon,
            sound: content.sound || 'default',
            tag: content.collapseKey,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: content.title,
                body: content.body,
              },
              badge: content.badge,
              sound: content.sound || 'default',
              mutableContent: content.mutableContent,
              contentAvailable: content.contentAvailable,
              category: content.actions ? 'CUSTOM_ACTIONS' : undefined,
            },
          },
          headers: {
            'apns-priority': content.priority === 'high' ? '10' : '5',
            'apns-expiration': content.ttl
              ? Math.floor(Date.now() / 1000 + content.ttl).toString()
              : undefined,
          },
        },
        webpush: {
          notification: {
            title: content.title,
            body: content.body,
            icon: content.icon,
            image: content.image,
            badge: content.badge?.toString(),
            actions: content.actions,
            data: content.data,
          },
          headers: {
            TTL: content.ttl?.toString() || '86400',
            Urgency: content.priority || 'normal',
          },
        },
      };

      // Add recipient information
      if (recipient.deviceTokens && recipient.deviceTokens.length > 0) {
        // Send to multiple tokens
        const response = await admin.messaging(this.firebaseApp).sendEach(
          recipient.deviceTokens.map((token) => ({
            ...baseMessage,
            token,
          }))
        );

        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(recipient.deviceTokens[idx]);
          }
        });

        return {
          success: response.successCount > 0,
          providerMessageId: response.responses[0]?.messageId,
          status: response.successCount > 0 ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          providerResponse: {
            successCount: response.successCount,
            failureCount: response.failureCount,
            failedTokens,
          },
        };
      } else {
        // Build message with proper type
        let message: admin.messaging.Message;

        if (recipient.topic) {
          message = { ...baseMessage, topic: recipient.topic };
        } else if (recipient.condition) {
          message = { ...baseMessage, condition: recipient.condition };
        } else {
          throw new Error('No valid recipient specified');
        }

        // Send single message
        const messageId = await admin.messaging(this.firebaseApp).send(message);

        return {
          success: true,
          providerMessageId: messageId,
          status: DeliveryStatus.SENT,
          providerResponse: { messageId },
        };
      }
    } catch (error) {
      this.logger.error('Failed to send Firebase push:', error);

      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
        providerResponse: {
          error: error.code,
          message: error.message,
        },
      };
    }
  }

  private async sendOneSignalPush(
    recipient: PushRecipient,
    content: PushContent,
    options?: any
  ): Promise<SendResult> {
    if (!this.config.oneSignal?.appId || !this.config.oneSignal?.apiKey) {
      throw new Error('OneSignal not configured');
    }

    try {
      const notification = {
        app_id: this.config.oneSignal.appId,
        headings: { en: content.title },
        contents: { en: content.body },
        data: content.data || {},
        // Add recipient targeting
        ...(recipient.userId
          ? { external_user_id: recipient.userId }
          : { include_player_ids: recipient.deviceTokens || [] }),
        // Add optional features
        ...(content.image && { big_picture: content.image }),
        ...(content.data?.actionUrl && { url: content.data.actionUrl }),
        ...(content.priority && { priority: content.priority === 'high' ? 10 : 5 }),
        ...(content.ttl && { ttl: content.ttl }),
        ...(content.sound && { android_sound: content.sound, ios_sound: content.sound }),
        ...(content.badge && { ios_badgeType: 'Increase', ios_badgeCount: content.badge }),
        // Add actions if provided
        ...(content.actions && {
          buttons: content.actions.map((action) => ({
            id: action.action,
            text: action.title,
            icon: action.icon,
          })),
        }),
        // Add platform-specific features
        ...(content.mutableContent && { mutable_content: true }),
        ...(content.contentAvailable && { content_available: true }),
        ...(content.collapseKey && { android_group: content.collapseKey }),
      };

      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.config.oneSignal.apiKey}`,
        },
        body: JSON.stringify(notification),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.join(', ') || 'OneSignal API error');
      }

      this.logger.log(`OneSignal notification sent: ${result.id}`);

      return {
        success: true,
        providerMessageId: result.id,
        status: DeliveryStatus.SENT,
        providerResponse: {
          id: result.id,
          recipients: result.recipients,
          external_id: result.external_id,
        },
      };
    } catch (error) {
      this.logger.error(`OneSignal push failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
        providerResponse: {
          error: error.message,
        },
      };
    }
  }

  async sendBulk(
    recipients: PushRecipient[],
    content: PushContent,
    options?: any
  ): Promise<SendResult[]> {
    // For Firebase, we can optimize by collecting all device tokens
    if (this.config.provider === 'firebase' && this.firebaseApp) {
      const allTokens = recipients.flatMap((r) => r.deviceTokens || []);

      if (allTokens.length > 0) {
        const batchSize = 500; // Firebase limit
        const results: SendResult[] = [];

        for (let i = 0; i < allTokens.length; i += batchSize) {
          const batch = allTokens.slice(i, i + batchSize);
          const result = await this.send({ deviceTokens: batch }, content, options);
          results.push(result);
        }

        return results;
      }
    }

    // Fallback to individual sends
    const results = await Promise.allSettled(
      recipients.map((recipient) => this.send(recipient, content, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason.message,
          status: DeliveryStatus.FAILED,
          recipient: recipients[index],
        };
      }
    });
  }

  async getStatus(providerMessageId: string): Promise<DeliveryStatus> {
    // Push notifications don't typically provide delivery status
    // This would need to be tracked through client-side events
    return DeliveryStatus.SENT;
  }

  async handleWebhook(data: any): Promise<void> {
    // Handle push notification events like delivery confirmations
    try {
      const { event, messageId, deviceToken, error } = data;

      switch (event) {
        case 'delivered':
          this.logger.log(`Push notification ${messageId} delivered`);
          break;
        case 'failed':
          this.logger.error(`Push notification ${messageId} failed: ${error}`);
          break;
        case 'unregistered':
          this.logger.warn(`Device token unregistered: ${deviceToken}`);
          // Handle token removal
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle push webhook:', error);
    }
  }

  validateRecipient(recipient: PushRecipient): boolean {
    return !!(
      (recipient.deviceTokens && recipient.deviceTokens.length > 0) ||
      recipient.topic ||
      recipient.condition
    );
  }

  validateContent(content: PushContent): boolean {
    if (!content.title || !content.body) {
      return false;
    }

    // Check platform-specific limits
    if (content.title.length > 200 || content.body.length > 4000) {
      return false;
    }

    return true;
  }

  getConfig(): PushConfig {
    return this.config;
  }

  isConfigured(): boolean {
    if (this.config.provider === 'firebase') {
      return !!this.firebaseApp;
    } else if (this.config.provider === 'onesignal') {
      return !!(this.config.oneSignal?.appId && this.config.oneSignal?.apiKey);
    }
    return false;
  }

  // Push-specific features
  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    if (this.config.provider !== 'firebase' || !this.firebaseApp) {
      throw new Error('Topic subscription only available with Firebase');
    }

    try {
      const response = await admin.messaging(this.firebaseApp).subscribeToTopic(tokens, topic);

      this.logger.log(`Subscribed ${response.successCount} devices to topic ${topic}`);

      return response.failureCount === 0;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    if (this.config.provider !== 'firebase' || !this.firebaseApp) {
      throw new Error('Topic unsubscription only available with Firebase');
    }

    try {
      const response = await admin.messaging(this.firebaseApp).unsubscribeFromTopic(tokens, topic);

      this.logger.log(`Unsubscribed ${response.successCount} devices from topic ${topic}`);

      return response.failureCount === 0;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      return false;
    }
  }

  async validateDeviceToken(token: string): Promise<boolean> {
    if (this.config.provider !== 'firebase' || !this.firebaseApp) {
      return true; // Can't validate without Firebase
    }

    try {
      // Send a dry run message to validate the token
      await admin.messaging(this.firebaseApp).send(
        {
          token,
          notification: {
            title: 'Test',
            body: 'Test',
          },
        },
        true // dry run
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}
