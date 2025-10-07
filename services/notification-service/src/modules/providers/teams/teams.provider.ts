import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  DeliveryStatus,
  type NotificationProvider,
  type SendResult,
} from '../interfaces/notification-provider.interface';

interface TeamsMessage {
  '@type': string;
  '@context': string;
  themeColor?: string;
  summary: string;
  sections?: Array<{
    activityTitle?: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts?: Array<{
      name: string;
      value: string;
    }>;
    text?: string;
    markdown?: boolean;
  }>;
  potentialAction?: Array<{
    '@type': string;
    name: string;
    targets: Array<{
      os: string;
      uri: string;
    }>;
  }>;
}

interface TeamsConfig {
  webhookUrl: string;
  defaultThemeColor?: string;
  enableMarkdown?: boolean;
}

@Injectable()
export class TeamsProvider implements NotificationProvider {
  private readonly logger = new Logger(TeamsProvider.name);
  private config: TeamsConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.config = {
      webhookUrl: this.configService.get('TEAMS_WEBHOOK_URL', ''),
      defaultThemeColor: this.configService.get('TEAMS_DEFAULT_COLOR', '0078D4'),
      enableMarkdown: this.configService.get('TEAMS_ENABLE_MARKDOWN', true),
    };
  }

  async send(to: string, subject: string, content: string, options?: any): Promise<SendResult> {
    try {
      // Validate webhook URL
      if (!this.config.webhookUrl) {
        throw new Error('Teams webhook URL not configured');
      }

      // Build Teams message
      const message = this.buildTeamsMessage(subject, content, options);

      // Send to Teams
      const response = await firstValueFrom(this.httpService.post(this.config.webhookUrl, message));

      if (response.status === 200 && response.data === 1) {
        this.logger.log(`Teams notification sent successfully: ${subject}`);
        return {
          success: true,
          providerMessageId: `teams-${Date.now()}`,
          status: DeliveryStatus.SENT,
          providerResponse: response.data,
        };
      } else {
        throw new Error(`Teams API returned unexpected response: ${response.data}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send Teams notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
      };
    }
  }

  async sendBulk(
    recipients: Array<{ to: string; subject: string; content: string; options?: any }>
  ): Promise<SendResult[]> {
    // Teams doesn't support bulk sending to individual users via webhook
    // Each message needs to be sent separately
    return Promise.all(
      recipients.map(({ to, subject, content, options }) =>
        this.send(to, subject, content, options)
      )
    );
  }

  async getStatus(messageId: string): Promise<DeliveryStatus> {
    // Teams webhooks don't provide message status tracking
    this.logger.warn(`Teams provider does not support message status tracking for ${messageId}`);
    return DeliveryStatus.UNKNOWN;
  }

  getType(): 'teams' {
    return 'teams';
  }

  validateRecipient(recipient: any): boolean {
    return typeof recipient === 'string' && recipient.length > 0;
  }

  validateContent(content: any): boolean {
    return content && (content.subject || content.content);
  }

  getConfig(): { provider: string; webhookUrl?: string } {
    return {
      provider: 'teams',
      webhookUrl: this.config?.webhookUrl,
    };
  }

  isConfigured(): boolean {
    return !!(this.config && this.config.webhookUrl);
  }

  async handleWebhook(payload: any): Promise<void> {
    // Teams incoming webhooks are one-way only
    this.logger.warn('Teams incoming webhooks do not support callbacks');
  }

  private buildTeamsMessage(subject: string, content: string, options?: any): TeamsMessage {
    const message: TeamsMessage = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: options?.themeColor || this.config.defaultThemeColor,
      summary: subject,
      sections: [],
    };

    // Add main content section
    const mainSection: any = {
      activityTitle: subject,
      text: content,
      markdown: this.config.enableMarkdown,
    };

    // Add optional elements from options
    if (options?.subtitle) {
      mainSection.activitySubtitle = options.subtitle;
    }

    if (options?.image) {
      mainSection.activityImage = options.image;
    }

    message.sections!.push(mainSection);

    // Add facts if provided
    if (options?.facts && Array.isArray(options.facts)) {
      const factsSection = {
        facts: options.facts.map((fact: any) => ({
          name: fact.name || fact.key || 'Info',
          value: String(fact.value),
        })),
      };
      message.sections!.push(factsSection);
    }

    // Add additional sections if provided
    if (options?.sections && Array.isArray(options.sections)) {
      message.sections!.push(...options.sections);
    }

    // Add action buttons if provided
    if (options?.actions && Array.isArray(options.actions)) {
      message.potentialAction = options.actions.map((action: any) => ({
        '@type': 'OpenUri',
        name: action.name || action.label || 'View',
        targets: [
          {
            os: 'default',
            uri: action.url || action.uri,
          },
        ],
      }));
    }

    return message;
  }

  getName(): string {
    return 'teams';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.webhookUrl) {
      this.logger.warn('Teams webhook URL not configured');
      return false;
    }

    try {
      // Test with a simple validation message
      const testMessage = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: 'Configuration Test',
        text: 'Teams integration validation test',
      };

      const response = await firstValueFrom(
        this.httpService.post(this.config.webhookUrl, testMessage)
      );

      return response.status === 200 && response.data === 1;
    } catch (error) {
      this.logger.error(`Teams configuration validation failed: ${error.message}`);
      return false;
    }
  }
}
