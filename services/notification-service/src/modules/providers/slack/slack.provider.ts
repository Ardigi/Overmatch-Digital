import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import {
  DeliveryStatus,
  type NotificationProvider,
  type NotificationProviderType,
  type ProviderConfig,
  type SendResult,
} from '../interfaces/notification-provider.interface';

export interface SlackConfig extends ProviderConfig {
  provider: 'slack';
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  defaultChannel?: string;
}

export interface SlackContent {
  text: string;
  blocks?: any[];
  attachments?: any[];
  threadTs?: string;
  mrkdwn?: boolean;
}

export interface SlackRecipient {
  channel?: string;
  userId?: string;
  email?: string;
  name?: string;
}

@Injectable()
export class SlackProviderService implements NotificationProvider {
  private readonly logger = new Logger(SlackProviderService.name);
  private slackClient: WebClient;
  private config: SlackConfig;

  constructor(private readonly configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    this.config = {
      provider: 'slack',
      botToken: this.configService.get<string>('SLACK_BOT_TOKEN'),
      appToken: this.configService.get<string>('SLACK_APP_TOKEN'),
      signingSecret: this.configService.get<string>('SLACK_SIGNING_SECRET'),
      defaultChannel: this.configService.get<string>('SLACK_DEFAULT_CHANNEL'),
    };

    if (this.config.botToken) {
      this.slackClient = new WebClient(this.config.botToken);
      this.logger.log('Slack provider configured');
    } else {
      this.logger.warn('Slack bot token not configured');
    }
  }

  getType(): NotificationProviderType {
    return 'slack';
  }

  async send(recipient: SlackRecipient, content: SlackContent, options?: any): Promise<SendResult> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      // Determine the channel to send to
      let channel: string;
      if (recipient.channel) {
        channel = recipient.channel;
      } else if (recipient.userId) {
        // Open a DM with the user
        const dmResult = await this.slackClient.conversations.open({
          users: recipient.userId,
        });
        channel = dmResult.channel.id;
      } else if (recipient.email) {
        // Look up user by email
        const userResult = await this.slackClient.users.lookupByEmail({
          email: recipient.email,
        });
        const dmResult = await this.slackClient.conversations.open({
          users: userResult.user.id,
        });
        channel = dmResult.channel.id;
      } else if (this.config.defaultChannel) {
        channel = this.config.defaultChannel;
      } else {
        throw new Error('No valid recipient channel specified');
      }

      // Prepare message options
      const messageOptions: any = {
        channel,
        text: content.text,
        mrkdwn: content.mrkdwn !== false, // Default to true
      };

      // Add blocks if provided
      if (content.blocks && content.blocks.length > 0) {
        messageOptions.blocks = content.blocks;
      }

      // Add attachments if provided
      if (content.attachments && content.attachments.length > 0) {
        messageOptions.attachments = content.attachments;
      }

      // Add thread timestamp if replying to a thread
      if (content.threadTs) {
        messageOptions.thread_ts = content.threadTs;
      }

      // Merge additional options
      Object.assign(messageOptions, options);

      // Send the message
      const result = await this.slackClient.chat.postMessage(messageOptions);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to send Slack message');
      }

      this.logger.log(`Slack message sent successfully: ${result.ts}`);

      return {
        success: true,
        providerMessageId: result.ts,
        status: DeliveryStatus.DELIVERED,
        providerResponse: {
          ts: result.ts,
          channel: result.channel,
          message: result.message,
        },
      };
    } catch (error) {
      this.logger.error('Failed to send Slack message:', error);

      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
        providerResponse: {
          error: error.data?.error || error.message,
          response: error.data,
        },
      };
    }
  }

  async sendBulk(
    recipients: SlackRecipient[],
    content: SlackContent,
    options?: any
  ): Promise<SendResult[]> {
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
    // Slack messages are delivered immediately
    // You could implement message reactions or read receipts tracking here
    return DeliveryStatus.DELIVERED;
  }

  async handleWebhook(data: any): Promise<void> {
    try {
      const { type, event } = data;

      this.logger.log(`Slack webhook: ${type}`);

      switch (type) {
        case 'message':
          // Handle message events
          break;
        case 'app_mention':
          // Handle mentions
          break;
        case 'reaction_added':
          // Track engagement
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle Slack webhook:', error);
    }
  }

  validateRecipient(recipient: SlackRecipient): boolean {
    return !!(recipient.channel || recipient.userId || recipient.email);
  }

  validateContent(content: SlackContent): boolean {
    if (!content.text && (!content.blocks || content.blocks.length === 0)) {
      return false;
    }

    // Slack message text limit is 40,000 characters
    if (content.text && content.text.length > 40000) {
      return false;
    }

    return true;
  }

  getConfig(): SlackConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return !!this.config.botToken;
  }

  // Slack-specific features
  async sendEphemeral(channel: string, user: string, content: SlackContent): Promise<SendResult> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.chat.postEphemeral({
        channel,
        user,
        text: content.text,
        blocks: content.blocks,
        attachments: content.attachments,
      });

      return {
        success: true,
        providerMessageId: result.message_ts,
        status: DeliveryStatus.DELIVERED,
        providerResponse: result,
      };
    } catch (error) {
      this.logger.error('Failed to send ephemeral message:', error);
      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
      };
    }
  }

  async updateMessage(
    channel: string,
    timestamp: string,
    content: SlackContent
  ): Promise<SendResult> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.chat.update({
        channel,
        ts: timestamp,
        text: content.text,
        blocks: content.blocks,
        attachments: content.attachments,
      });

      return {
        success: true,
        providerMessageId: result.ts,
        status: DeliveryStatus.DELIVERED,
        providerResponse: result,
      };
    } catch (error) {
      this.logger.error('Failed to update message:', error);
      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
      };
    }
  }

  async deleteMessage(channel: string, timestamp: string): Promise<boolean> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      await this.slackClient.chat.delete({
        channel,
        ts: timestamp,
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      return false;
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.users.lookupByEmail({ email });
      return result.user;
    } catch (error) {
      this.logger.error(`Failed to look up user by email ${email}:`, error);
      return null;
    }
  }

  async createChannel(name: string, isPrivate: boolean = false): Promise<string> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      const result = await this.slackClient.conversations.create({
        name,
        is_private: isPrivate,
      });
      return result.channel.id;
    } catch (error) {
      this.logger.error(`Failed to create channel ${name}:`, error);
      throw error;
    }
  }

  async inviteToChannel(channel: string, users: string[]): Promise<boolean> {
    if (!this.slackClient) {
      throw new Error('Slack client not initialized');
    }

    try {
      await this.slackClient.conversations.invite({
        channel,
        users: users.join(','),
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to invite users to channel ${channel}:`, error);
      return false;
    }
  }
}
