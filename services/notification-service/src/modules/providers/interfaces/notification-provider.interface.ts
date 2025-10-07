export type NotificationProviderType =
  | 'email'
  | 'sms'
  | 'slack'
  | 'teams'
  | 'in-app'
  | 'push'
  | 'webhook';

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  UNKNOWN = 'unknown',
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  status: DeliveryStatus;
  error?: string;
  providerResponse?: any;
  recipient?: any;
}

export interface ProviderConfig {
  provider: string;
  [key: string]: any;
}

export interface NotificationProvider {
  getType(): NotificationProviderType;
  send(recipient: any, content: any, options?: any): Promise<SendResult>;
  sendBulk(recipients: any[], content: any, options?: any): Promise<SendResult[]>;
  getStatus(providerMessageId: string): Promise<DeliveryStatus>;
  handleWebhook(data: any): Promise<void>;
  validateRecipient(recipient: any): boolean;
  validateContent(content: any): boolean;
  getConfig(): ProviderConfig;
  isConfigured(): boolean;
}
