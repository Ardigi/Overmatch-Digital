import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as AWS from 'aws-sdk';
import * as nodemailer from 'nodemailer';
import { NotificationChannel } from '../../notifications/entities/notification.entity';

export enum EmailProvider {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid',
  AWS_SES = 'aws_ses',
  MAILGUN = 'mailgun',
}

export interface EmailConfig {
  provider: EmailProvider;
  fromEmail: string;
  fromName?: string;
  // SMTP specific
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  // SendGrid specific
  apiKey?: string;
  // AWS SES specific
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  // Mailgun specific
  domain?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  customArgs?: Record<string, any>;
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: EmailProvider;
  channel: NotificationChannel;
  response?: any;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ProviderStatus {
  healthy: boolean;
  lastChecked: Date;
  latency: number;
  error?: string;
  limits?: {
    daily?: number;
    remaining?: number;
  };
}

@Injectable()
export class EmailProviderService {
  private readonly logger = new Logger(EmailProviderService.name);
  private config: EmailConfig;
  private transporter: any;
  private lastVerificationError: string | null = null;
  public readonly name = 'email';
  public readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly configService: ConfigService) {}

  async configure(config: EmailConfig): Promise<void> {
    this.config = config;

    switch (config.provider) {
      case EmailProvider.SMTP:
        await this.configureSMTP(config);
        break;
      case EmailProvider.SENDGRID:
        await this.configureSendGrid(config);
        break;
      case EmailProvider.AWS_SES:
        await this.configureAWSSES(config);
        break;
      case EmailProvider.MAILGUN:
        await this.configureMailgun(config);
        break;
      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  }

  private async configureSMTP(config: EmailConfig): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure || config.port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    // Verify connection
    await this.transporter.verify();
    this.logger.log('SMTP transporter configured and verified');
  }

  private async configureSendGrid(config: EmailConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('SendGrid API key is required');
    }

    sgMail.setApiKey(config.apiKey);
    this.transporter = sgMail;
    this.logger.log('SendGrid configured');
  }

  private async configureAWSSES(config: EmailConfig): Promise<void> {
    AWS.config.update({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || 'us-east-1',
    });

    this.transporter = new AWS.SES({ apiVersion: '2010-12-01' });
    this.logger.log('AWS SES configured');
  }

  private async configureMailgun(config: EmailConfig): Promise<void> {
    const mailgun = require('mailgun-js');
    this.transporter = mailgun({
      apiKey: config.apiKey,
      domain: config.domain,
      host: 'api.mailgun.net',
    });

    this.logger.log('Mailgun configured');
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (this.config.provider) {
        case EmailProvider.SMTP:
          result = await this.sendSMTP(options);
          break;
        case EmailProvider.SENDGRID:
          result = await this.sendSendGrid(options);
          break;
        case EmailProvider.AWS_SES:
          result = await this.sendAWSSES(options);
          break;
        case EmailProvider.MAILGUN:
          result = await this.sendMailgun(options);
          break;
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        messageId: this.extractMessageId(result),
        provider: this.config.provider,
        channel: NotificationChannel.EMAIL,
        response: result,
        timestamp: new Date(),
        metadata: {
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(`Email send failed: ${error.message}`, error.stack);

      return {
        success: false,
        provider: this.config.provider,
        channel: NotificationChannel.EMAIL,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          duration,
        },
      };
    }
  }

  private async sendSMTP(options: EmailOptions): Promise<any> {
    const mailOptions = {
      from: this.formatFrom(),
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: this.formatRecipients(options.cc),
      bcc: this.formatRecipients(options.bcc),
      replyTo: options.replyTo,
      attachments: options.attachments,
      headers: options.headers,
    };

    return await this.transporter.sendMail(mailOptions);
  }

  private async sendSendGrid(options: EmailOptions): Promise<any> {
    const msg = {
      to: options.to,
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      attachments: this.formatSendGridAttachments(options.attachments),
      customArgs: options.customArgs,
      trackingSettings: options.trackingSettings
        ? {
            clickTracking: { enable: options.trackingSettings.clickTracking || false },
            openTracking: { enable: options.trackingSettings.openTracking || false },
            subscriptionTracking: { enable: true },
          }
        : undefined,
    };

    const [response] = await sgMail.send(msg);
    return response;
  }

  private async sendAWSSES(options: EmailOptions): Promise<any> {
    const params = {
      Source: this.formatFrom(),
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
        CcAddresses: this.formatAWSRecipients(options.cc),
        BccAddresses: this.formatAWSRecipients(options.bcc),
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: options.text
            ? {
                Data: options.text,
                Charset: 'UTF-8',
              }
            : undefined,
          Html: options.html
            ? {
                Data: options.html,
                Charset: 'UTF-8',
              }
            : undefined,
        },
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      Tags: options.tags
        ? options.tags.map((tag) => ({
            Name: tag,
            Value: 'true',
          }))
        : undefined,
    };

    return await this.transporter.sendEmail(params).promise();
  }

  private async sendMailgun(options: EmailOptions): Promise<any> {
    const data = {
      from: this.formatFrom(),
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: this.formatRecipients(options.cc),
      bcc: this.formatRecipients(options.bcc),
      'h:Reply-To': options.replyTo,
      attachment: options.attachments,
      'o:tag': options.tags,
    };

    // Add custom headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        data[`h:${key}`] = value;
      });
    }

    return await this.transporter.messages().send(data);
  }

  async verify(): Promise<boolean> {
    try {
      this.lastVerificationError = null; // Clear any previous error
      switch (this.config.provider) {
        case EmailProvider.SMTP:
          await this.transporter.verify();
          return true;
        case EmailProvider.SENDGRID:
          // SendGrid doesn't have a verify method, assume configured correctly
          return true;
        case EmailProvider.AWS_SES:
          await this.transporter.getSendQuota().promise();
          return true;
        case EmailProvider.MAILGUN:
          await this.transporter.get('/domains');
          return true;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Email provider verification failed: ${error.message}`);
      this.lastVerificationError = error.message;
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const startTime = Date.now();

    try {
      const healthy = await this.verify();
      const latency = Date.now() - startTime;

      // If verify returned false and we have an error, return error response
      if (!healthy && this.lastVerificationError) {
        return {
          healthy: false,
          lastChecked: new Date(),
          latency,
          error: this.lastVerificationError,
        };
      }

      const result: ProviderStatus = {
        healthy,
        lastChecked: new Date(),
        latency,
        limits: {},
      };

      if (this.config.provider === EmailProvider.AWS_SES && healthy) {
        try {
          const quota = await this.transporter.getSendQuota().promise();
          result.limits = {
            daily: quota.Max24HourSend,
            remaining: quota.Max24HourSend - quota.SentLast24Hours,
          };
        } catch (error) {
          // If we can't get quota, still return healthy status with empty limits
        }
      }

      return result;
    } catch (error) {
      return {
        healthy: false,
        lastChecked: new Date(),
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  async handleWebhook(payload: any, headers: any): Promise<void> {
    switch (this.config.provider) {
      case EmailProvider.SENDGRID:
        await this.handleSendGridWebhook(payload);
        break;
      case EmailProvider.MAILGUN:
        await this.handleMailgunWebhook(payload);
        break;
      case EmailProvider.AWS_SES:
        await this.handleAWSSESWebhook(payload);
        break;
      default:
        this.logger.warn(`Webhook handling not implemented for ${this.config.provider}`);
    }
  }

  private async handleSendGridWebhook(events: any[]): Promise<void> {
    for (const event of events) {
      this.logger.log(`SendGrid event: ${event.event} for ${event.email}`);
      // Process event (update notification status, etc.)
    }
  }

  private async handleMailgunWebhook(payload: any): Promise<void> {
    this.logger.log(`Mailgun event: ${payload.event} for ${payload.recipient}`);
    // Process event
  }

  private async handleAWSSESWebhook(payload: any): Promise<void> {
    // Parse SNS notification and process
    this.logger.log('AWS SES webhook received');
  }

  private formatFrom(): string {
    if (this.config.fromName) {
      return `${this.config.fromName} <${this.config.fromEmail}>`;
    }
    return this.config.fromEmail;
  }

  private formatRecipients(recipients?: string | string[]): string | undefined {
    if (!recipients) return undefined;
    return Array.isArray(recipients) ? recipients.join(',') : recipients;
  }

  private formatAWSRecipients(recipients?: string | string[]): string[] {
    if (!recipients) return [];
    return Array.isArray(recipients) ? recipients : [recipients];
  }

  private formatSendGridAttachments(attachments?: EmailAttachment[]): any[] {
    if (!attachments || attachments.length === 0) return undefined;

    return attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
      type: att.contentType,
      disposition: 'attachment',
    }));
  }

  private extractMessageId(response: any): string {
    switch (this.config.provider) {
      case EmailProvider.SMTP:
        return response.messageId;
      case EmailProvider.SENDGRID:
        return response.headers?.['x-message-id'];
      case EmailProvider.AWS_SES:
        return response.MessageId;
      case EmailProvider.MAILGUN:
        return response.id;
      default:
        return undefined;
    }
  }
}
