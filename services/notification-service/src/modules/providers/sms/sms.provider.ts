import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import {
  DeliveryStatus,
  type NotificationProvider,
  type NotificationProviderType,
  type ProviderConfig,
  type SendResult,
} from '../interfaces/notification-provider.interface';

export interface SmsConfig extends ProviderConfig {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid?: string;
  statusCallbackUrl?: string;
}

export interface SmsContent {
  body: string;
  mediaUrls?: string[];
}

export interface SmsRecipient {
  phone: string;
  name?: string;
  countryCode?: string;
}

@Injectable()
export class SmsProviderService implements NotificationProvider {
  private readonly logger = new Logger(SmsProviderService.name);
  private twilioClient: twilio.Twilio;
  private config: SmsConfig;

  constructor(private readonly configService: ConfigService) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    this.config = {
      provider: 'twilio',
      accountSid: this.configService.get<string>('SMS_TWILIO_ACCOUNT_SID'),
      authToken: this.configService.get<string>('SMS_TWILIO_AUTH_TOKEN'),
      fromNumber: this.configService.get<string>('SMS_TWILIO_FROM_NUMBER'),
      messagingServiceSid: this.configService.get<string>('SMS_TWILIO_MESSAGING_SERVICE_SID'),
      statusCallbackUrl: this.configService.get<string>('SMS_TWILIO_STATUS_CALLBACK_URL'),
    };

    if (this.config.accountSid && this.config.authToken) {
      this.twilioClient = twilio(this.config.accountSid, this.config.authToken);
      this.logger.log('Twilio SMS provider configured');
    } else {
      this.logger.warn('Twilio credentials not configured');
    }
  }

  getType(): NotificationProviderType {
    return 'sms';
  }

  async send(recipient: SmsRecipient, content: SmsContent, options?: any): Promise<SendResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const messageOptions: any = {
        body: content.body,
        to: this.formatPhoneNumber(recipient.phone, recipient.countryCode),
      };

      // Use messaging service if configured, otherwise use from number
      if (this.config.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.config.messagingServiceSid;
      } else {
        messageOptions.from = this.config.fromNumber;
      }

      // Add media URLs if provided (MMS)
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        messageOptions.mediaUrl = content.mediaUrls;
      }

      // Add status callback if configured
      if (this.config.statusCallbackUrl) {
        messageOptions.statusCallback = this.config.statusCallbackUrl;
      }

      // Merge additional options
      Object.assign(messageOptions, options);

      const message: MessageInstance = await this.twilioClient.messages.create(messageOptions);

      this.logger.log(`SMS sent successfully: ${message.sid}`);

      return {
        success: true,
        providerMessageId: message.sid,
        status: this.mapTwilioStatus(message.status),
        providerResponse: {
          sid: message.sid,
          status: message.status,
          dateCreated: message.dateCreated,
          dateSent: message.dateSent,
          price: message.price,
          priceUnit: message.priceUnit,
          errorCode: message.errorCode,
          errorMessage: message.errorMessage,
        },
      };
    } catch (error) {
      this.logger.error('Failed to send SMS:', error);

      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
        providerResponse: {
          errorCode: error.code,
          errorMessage: error.message,
          moreInfo: error.moreInfo,
        },
      };
    }
  }

  async sendBulk(
    recipients: SmsRecipient[],
    content: SmsContent,
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
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages(providerMessageId).fetch();
      return this.mapTwilioStatus(message.status);
    } catch (error) {
      this.logger.error(`Failed to get SMS status for ${providerMessageId}:`, error);
      return DeliveryStatus.UNKNOWN;
    }
  }

  async handleWebhook(data: any): Promise<void> {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = data;

      this.logger.log(`Twilio webhook: ${MessageStatus} for ${MessageSid}`);

      // Handle different status updates
      switch (MessageStatus) {
        case 'delivered':
          // Update notification as delivered
          break;
        case 'failed':
        case 'undelivered':
          // Update notification as failed
          this.logger.error(`SMS delivery failed: ${ErrorCode} - ${ErrorMessage}`);
          break;
      }

      // You would emit an event here to update the notification status
    } catch (error) {
      this.logger.error('Failed to handle Twilio webhook:', error);
    }
  }

  validateRecipient(recipient: SmsRecipient): boolean {
    if (!recipient.phone) {
      return false;
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(recipient.phone.replace(/\s/g, ''));
  }

  validateContent(content: SmsContent): boolean {
    if (!content.body || content.body.trim().length === 0) {
      return false;
    }

    // Check SMS length (160 characters for single SMS, 1600 for concatenated)
    if (content.body.length > 1600) {
      return false;
    }

    return true;
  }

  getConfig(): SmsConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return !!(
      this.config.accountSid &&
      this.config.authToken &&
      (this.config.fromNumber || this.config.messagingServiceSid)
    );
  }

  private formatPhoneNumber(phone: string, countryCode?: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Add country code if not present
    if (!cleaned.startsWith('+')) {
      if (countryCode) {
        cleaned = countryCode + cleaned;
      } else if (cleaned.length === 10) {
        // Assume US number if 10 digits
        cleaned = '1' + cleaned;
      }
    }

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  private mapTwilioStatus(status: string): DeliveryStatus {
    switch (status) {
      case 'queued':
      case 'accepted':
        return DeliveryStatus.PENDING;
      case 'sending':
        return DeliveryStatus.SENT;
      case 'sent':
      case 'delivered':
        return DeliveryStatus.DELIVERED;
      case 'failed':
      case 'undelivered':
        return DeliveryStatus.FAILED;
      default:
        return DeliveryStatus.UNKNOWN;
    }
  }

  // Additional Twilio-specific features
  async sendVerificationCode(phone: string, code: string, template?: string): Promise<SendResult> {
    const body = template
      ? template.replace('{{code}}', code)
      : `Your verification code is: ${code}`;

    return this.send({ phone }, { body });
  }

  async checkPhoneNumberValidity(phone: string): Promise<boolean> {
    if (!this.twilioClient) {
      return false;
    }

    try {
      const lookup = await this.twilioClient.lookups.v1.phoneNumbers(phone).fetch();

      return !!lookup.phoneNumber;
    } catch (error) {
      this.logger.error(`Phone number validation failed for ${phone}:`, error);
      return false;
    }
  }

  async getMessageDetails(messageSid: string): Promise<any> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        body: message.body,
        to: message.to,
        from: message.from,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        price: message.price,
        priceUnit: message.priceUnit,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        numSegments: message.numSegments,
        numMedia: message.numMedia,
      };
    } catch (error) {
      this.logger.error(`Failed to get message details for ${messageSid}:`, error);
      throw error;
    }
  }
}
