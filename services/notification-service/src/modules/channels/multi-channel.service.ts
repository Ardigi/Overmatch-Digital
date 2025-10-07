import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as twilio from 'twilio';
import * as AWS from 'aws-sdk';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams',
  IN_APP = 'in_app',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface NotificationRequest {
  id?: string;
  channel: NotificationChannel;
  recipient: string | string[];
  subject?: string;
  template?: string;
  templateData?: Record<string, any>;
  content?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  scheduledAt?: Date;
  expiresAt?: Date;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
  };
}

export interface NotificationResult {
  id: string;
  channel: NotificationChannel;
  status: 'sent' | 'failed' | 'queued' | 'scheduled';
  sentAt?: Date;
  error?: string;
  messageId?: string;
  attempts?: number;
}

export interface ChannelProvider {
  name: string;
  channel: NotificationChannel;
  send(request: NotificationRequest): Promise<NotificationResult>;
  validateRecipient(recipient: string): boolean;
  getStatus(messageId: string): Promise<any>;
}

@Injectable()
export class MultiChannelService {
  private readonly logger = new Logger(MultiChannelService.name);
  private readonly channelProviders = new Map<NotificationChannel, ChannelProvider>();
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: twilio.Twilio;
  private ses: AWS.SES;
  private sns: AWS.SNS;

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize Email provider
    this.initializeEmailProvider();
    
    // Initialize SMS provider
    this.initializeSMSProvider();
    
    // Initialize Push notification provider
    this.initializePushProvider();
    
    // Initialize Webhook provider
    this.initializeWebhookProvider();
    
    // Initialize Slack provider
    this.initializeSlackProvider();
    
    // Initialize Teams provider
    this.initializeTeamsProvider();
    
    // Initialize In-App provider
    this.initializeInAppProvider();
  }

  private initializeEmailProvider() {
    const emailProvider = this.configService.get('EMAIL_PROVIDER', 'smtp');
    
    if (emailProvider === 'ses') {
      // AWS SES
      this.ses = new AWS.SES({
        region: this.configService.get('AWS_REGION', 'us-east-1'),
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      });
      
      const sesProvider: ChannelProvider = {
        name: 'AWS SES',
        channel: NotificationChannel.EMAIL,
        send: async (request) => this.sendEmailViaSES(request),
        validateRecipient: (recipient) => this.validateEmail(recipient),
        getStatus: async (messageId) => this.getSESMessageStatus(messageId),
      };
      
      this.channelProviders.set(NotificationChannel.EMAIL, sesProvider);
    } else {
      // SMTP
      this.emailTransporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: this.configService.get('SMTP_SECURE', false),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
      
      const smtpProvider: ChannelProvider = {
        name: 'SMTP',
        channel: NotificationChannel.EMAIL,
        send: async (request) => this.sendEmailViaSMTP(request),
        validateRecipient: (recipient) => this.validateEmail(recipient),
        getStatus: async () => ({ status: 'unknown' }),
      };
      
      this.channelProviders.set(NotificationChannel.EMAIL, smtpProvider);
    }
  }

  private initializeSMSProvider() {
    const smsProvider = this.configService.get('SMS_PROVIDER', 'twilio');
    
    if (smsProvider === 'twilio') {
      this.twilioClient = twilio(
        this.configService.get('TWILIO_ACCOUNT_SID'),
        this.configService.get('TWILIO_AUTH_TOKEN'),
      );
      
      const twilioProvider: ChannelProvider = {
        name: 'Twilio',
        channel: NotificationChannel.SMS,
        send: async (request) => this.sendSMSViaTwilio(request),
        validateRecipient: (recipient) => this.validatePhoneNumber(recipient),
        getStatus: async (messageId) => this.getTwilioMessageStatus(messageId),
      };
      
      this.channelProviders.set(NotificationChannel.SMS, twilioProvider);
    } else if (smsProvider === 'sns') {
      this.sns = new AWS.SNS({
        region: this.configService.get('AWS_REGION', 'us-east-1'),
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      });
      
      const snsProvider: ChannelProvider = {
        name: 'AWS SNS',
        channel: NotificationChannel.SMS,
        send: async (request) => this.sendSMSViaSNS(request),
        validateRecipient: (recipient) => this.validatePhoneNumber(recipient),
        getStatus: async () => ({ status: 'unknown' }),
      };
      
      this.channelProviders.set(NotificationChannel.SMS, snsProvider);
    }
  }

  private initializePushProvider() {
    const pushProvider: ChannelProvider = {
      name: 'FCM/APNS',
      channel: NotificationChannel.PUSH,
      send: async (request) => this.sendPushNotification(request),
      validateRecipient: (recipient) => true,
      getStatus: async () => ({ status: 'unknown' }),
    };
    
    this.channelProviders.set(NotificationChannel.PUSH, pushProvider);
  }

  private initializeWebhookProvider() {
    const webhookProvider: ChannelProvider = {
      name: 'Webhook',
      channel: NotificationChannel.WEBHOOK,
      send: async (request) => this.sendWebhook(request),
      validateRecipient: (recipient) => this.validateURL(recipient),
      getStatus: async () => ({ status: 'unknown' }),
    };
    
    this.channelProviders.set(NotificationChannel.WEBHOOK, webhookProvider);
  }

  private initializeSlackProvider() {
    const slackProvider: ChannelProvider = {
      name: 'Slack',
      channel: NotificationChannel.SLACK,
      send: async (request) => this.sendSlackMessage(request),
      validateRecipient: (recipient) => recipient.startsWith('https://hooks.slack.com/'),
      getStatus: async () => ({ status: 'unknown' }),
    };
    
    this.channelProviders.set(NotificationChannel.SLACK, slackProvider);
  }

  private initializeTeamsProvider() {
    const teamsProvider: ChannelProvider = {
      name: 'Microsoft Teams',
      channel: NotificationChannel.TEAMS,
      send: async (request) => this.sendTeamsMessage(request),
      validateRecipient: (recipient) => recipient.includes('webhook.office.com'),
      getStatus: async () => ({ status: 'unknown' }),
    };
    
    this.channelProviders.set(NotificationChannel.TEAMS, teamsProvider);
  }

  private initializeInAppProvider() {
    const inAppProvider: ChannelProvider = {
      name: 'In-App',
      channel: NotificationChannel.IN_APP,
      send: async (request) => this.sendInAppNotification(request),
      validateRecipient: (recipient) => true,
      getStatus: async () => ({ status: 'unknown' }),
    };
    
    this.channelProviders.set(NotificationChannel.IN_APP, inAppProvider);
  }

  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    const notificationId = request.id || uuidv4();
    
    // Validate request
    if (!request.channel) {
      throw new Error('Notification channel is required');
    }
    
    const provider = this.channelProviders.get(request.channel);
    if (!provider) {
      throw new Error(`No provider configured for channel: ${request.channel}`);
    }
    
    // Validate recipients
    const recipients = Array.isArray(request.recipient) ? request.recipient : [request.recipient];
    for (const recipient of recipients) {
      if (!provider.validateRecipient(recipient)) {
        throw new Error(`Invalid recipient for ${request.channel}: ${recipient}`);
      }
    }
    
    try {
      // Check if scheduled
      if (request.scheduledAt && request.scheduledAt > new Date()) {
        return {
          id: notificationId,
          channel: request.channel,
          status: 'scheduled',
        };
      }
      
      // Send notification
      const result = await provider.send({
        ...request,
        id: notificationId,
      });
      
      this.logger.log(`Notification sent: ${notificationId} via ${request.channel}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to send notification: ${notificationId}`, error);
      
      return {
        id: notificationId,
        channel: request.channel,
        status: 'failed',
        error: error.message,
      };
    }
  }

  private async sendEmailViaSMTP(request: NotificationRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.recipient) ? request.recipient : [request.recipient];
    
    const mailOptions = {
      from: this.configService.get('EMAIL_FROM', 'noreply@soc-compliance.com'),
      to: recipients.join(','),
      subject: request.subject || 'Notification',
      text: request.content,
      html: request.content,
    };
    
    try {
      const info = await this.emailTransporter.sendMail(mailOptions);
      
      return {
        id: request.id!,
        channel: NotificationChannel.EMAIL,
        status: 'sent',
        sentAt: new Date(),
        messageId: info.messageId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendEmailViaSES(request: NotificationRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.recipient) ? request.recipient : [request.recipient];
    
    const params: AWS.SES.SendEmailRequest = {
      Source: this.configService.get('EMAIL_FROM', 'noreply@soc-compliance.com'),
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: request.subject || 'Notification',
        },
        Body: {
          Html: {
            Data: request.content || '',
          },
          Text: {
            Data: request.content || '',
          },
        },
      },
    };
    
    try {
      const result = await this.ses.sendEmail(params).promise();
      
      return {
        id: request.id!,
        channel: NotificationChannel.EMAIL,
        status: 'sent',
        sentAt: new Date(),
        messageId: result.MessageId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendSMSViaTwilio(request: NotificationRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.recipient) ? request.recipient : [request.recipient];
    
    try {
      const messages = await Promise.all(
        recipients.map(to =>
          this.twilioClient.messages.create({
            body: request.content || '',
            from: this.configService.get('TWILIO_PHONE_NUMBER'),
            to,
          })
        )
      );
      
      return {
        id: request.id!,
        channel: NotificationChannel.SMS,
        status: 'sent',
        sentAt: new Date(),
        messageId: messages[0].sid,
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendSMSViaSNS(request: NotificationRequest): Promise<NotificationResult> {
    const recipients = Array.isArray(request.recipient) ? request.recipient : [request.recipient];
    
    try {
      const results = await Promise.all(
        recipients.map(phoneNumber =>
          this.sns.publish({
            Message: request.content || '',
            PhoneNumber: phoneNumber,
          }).promise()
        )
      );
      
      return {
        id: request.id!,
        channel: NotificationChannel.SMS,
        status: 'sent',
        sentAt: new Date(),
        messageId: results[0].MessageId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendPushNotification(request: NotificationRequest): Promise<NotificationResult> {
    // Implementation would depend on FCM/APNS setup
    this.logger.debug('Push notification would be sent here');
    
    return {
      id: request.id!,
      channel: NotificationChannel.PUSH,
      status: 'sent',
      sentAt: new Date(),
    };
  }

  private async sendWebhook(request: NotificationRequest): Promise<NotificationResult> {
    const url = Array.isArray(request.recipient) ? request.recipient[0] : request.recipient;
    
    try {
      await axios.post(url, {
        id: request.id,
        subject: request.subject,
        content: request.content,
        metadata: request.metadata,
        timestamp: new Date(),
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Notification-Id': request.id,
        },
      });
      
      return {
        id: request.id!,
        channel: NotificationChannel.WEBHOOK,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendSlackMessage(request: NotificationRequest): Promise<NotificationResult> {
    const webhookUrl = Array.isArray(request.recipient) ? request.recipient[0] : request.recipient;
    
    try {
      await axios.post(webhookUrl, {
        text: request.subject || 'Notification',
        attachments: [{
          text: request.content,
          color: this.getPriorityColor(request.priority),
          footer: 'SOC Compliance Platform',
          ts: Math.floor(Date.now() / 1000),
        }],
      });
      
      return {
        id: request.id!,
        channel: NotificationChannel.SLACK,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendTeamsMessage(request: NotificationRequest): Promise<NotificationResult> {
    const webhookUrl = Array.isArray(request.recipient) ? request.recipient[0] : request.recipient;
    
    try {
      await axios.post(webhookUrl, {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: this.getPriorityColor(request.priority),
        summary: request.subject || 'Notification',
        sections: [{
          activityTitle: request.subject,
          text: request.content,
        }],
      });
      
      return {
        id: request.id!,
        channel: NotificationChannel.TEAMS,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  private async sendInAppNotification(request: NotificationRequest): Promise<NotificationResult> {
    // This would typically publish to a real-time channel (WebSocket, SSE, etc.)
    this.logger.debug('In-app notification would be sent here');
    
    return {
      id: request.id!,
      channel: NotificationChannel.IN_APP,
      status: 'sent',
      sentAt: new Date(),
    };
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  private validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getPriorityColor(priority?: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return '#FF0000';
      case NotificationPriority.HIGH:
        return '#FF8800';
      case NotificationPriority.NORMAL:
        return '#0088FF';
      case NotificationPriority.LOW:
        return '#888888';
      default:
        return '#0088FF';
    }
  }

  private async getSESMessageStatus(messageId: string): Promise<any> {
    // Would implement SES message tracking
    return { messageId, status: 'unknown' };
  }

  private async getTwilioMessageStatus(messageId: string): Promise<any> {
    try {
      const message = await this.twilioClient.messages(messageId).fetch();
      return {
        messageId,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      return { messageId, status: 'error', error: error.message };
    }
  }

  async getNotificationStatus(channel: NotificationChannel, messageId: string): Promise<any> {
    const provider = this.channelProviders.get(channel);
    if (!provider) {
      throw new Error(`No provider for channel: ${channel}`);
    }
    
    return await provider.getStatus(messageId);
  }

  getAvailableChannels(): NotificationChannel[] {
    return Array.from(this.channelProviders.keys());
  }

  isChannelConfigured(channel: NotificationChannel): boolean {
    return this.channelProviders.has(channel);
  }
}