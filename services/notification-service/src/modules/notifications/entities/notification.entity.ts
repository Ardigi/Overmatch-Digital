import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  PUSH = 'push',
}

export enum NotificationType {
  ALERT = 'alert',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  REMINDER = 'reminder',
  APPROVAL = 'approval',
  ASSIGNMENT = 'assignment',
  MENTION = 'mention',
  SYSTEM = 'system',
  TRANSACTIONAL = 'transactional',
  ANNOUNCEMENT = 'announcement',
  MARKETING = 'marketing',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
  UNSUBSCRIBED = 'unsubscribed',
  EXPIRED = 'expired',
}

export enum NotificationCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  AUDIT = 'audit',
  POLICY = 'policy',
  CONTROL = 'control',
  EVIDENCE = 'evidence',
  WORKFLOW = 'workflow',
  REPORT = 'report',
  USER = 'user',
  BILLING = 'billing',
  MARKETING = 'marketing',
}

export interface NotificationRecipient {
  id: string;
  userId?: string;
  email?: string;
  phone?: string;
  slackUserId?: string;
  teamsUserId?: string;
  webhookUrl?: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface NotificationContent {
  subject?: string;
  body: string;
  htmlBody?: string;
  smsBody?: string;
  slackBlocks?: any[];
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    encoding?: string;
  }>;
  actions?: Array<{
    label: string;
    url: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: Record<string, any>;
}

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: Date;
  status: NotificationStatus;
  error?: string;
  response?: any;
  duration?: number;
}

export interface NotificationContext {
  source?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Entity('notifications')
@Index(['organizationId', 'status'])
@Index(['recipientId', 'status'])
@Index(['channel', 'status'])
@Index(['type', 'priority'])
@Index(['scheduledFor'])
@Index(['createdAt', 'status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  notificationId: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel',
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type',
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    enumName: 'notification_priority',
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    enumName: 'notification_status',
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
    enumName: 'notification_category',
    default: NotificationCategory.SYSTEM,
  })
  category: NotificationCategory;

  @Column({ type: 'uuid', nullable: true })
  templateId?: string;

  @Column({ type: 'jsonb' })
  recipient: NotificationRecipient;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'jsonb' })
  content: NotificationContent;

  @Column({ type: 'jsonb', nullable: true })
  variables?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  openedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  clickedAt?: Date;

  @Column({ type: 'integer', default: 0 })
  openCount: number;

  @Column({ type: 'integer', default: 0 })
  clickCount: number;

  @Column({ type: 'jsonb', nullable: true })
  deliveryAttempts?: DeliveryAttempt[];

  @Column({ type: 'integer', default: 0 })
  deliveryAttemptsCount: number;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse?: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerMessageId?: string;

  @Column({ type: 'jsonb', nullable: true })
  tracking?: {
    opens?: Array<{ timestamp: Date; ip?: string; userAgent?: string }>;
    clicks?: Array<{ timestamp: Date; url: string; ip?: string; userAgent?: string }>;
    bounces?: Array<{ timestamp: Date; type: string; reason: string }>;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  groupId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  batchId?: string;

  @Column({ type: 'boolean', default: false })
  isTransactional: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'jsonb', nullable: true })
  context?: NotificationContext;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Computed properties
  get isScheduled(): boolean {
    return !!this.scheduledFor && this.scheduledFor > new Date();
  }

  get isExpired(): boolean {
    return !!this.expiresAt && this.expiresAt < new Date();
  }

  get deliveryRate(): number {
    if (this.status === NotificationStatus.DELIVERED) return 100;
    if (this.status === NotificationStatus.FAILED) return 0;
    return 0;
  }

  get engagementRate(): number {
    if (this.status !== NotificationStatus.DELIVERED) return 0;
    return ((this.openCount > 0 ? 1 : 0) + (this.clickCount > 0 ? 1 : 0)) * 50;
  }

  // Methods
  @BeforeInsert()
  generateNotificationId() {
    if (!this.notificationId) {
      this.notificationId = `notif_${uuidv4()}`;
    }
  }

  markAsQueued(): void {
    this.status = NotificationStatus.QUEUED;
  }

  markAsSending(): void {
    this.status = NotificationStatus.SENDING;
  }

  markAsSent(providerMessageId?: string, providerResponse?: any): void {
    this.status = NotificationStatus.SENT;
    this.sentAt = new Date();
    this.providerMessageId = providerMessageId;
    this.providerResponse = providerResponse;
  }

  markAsDelivered(): void {
    this.status = NotificationStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  markAsFailed(error: string): void {
    this.status = NotificationStatus.FAILED;
    this.lastError = error;
  }

  markAsBounced(reason: string): void {
    this.status = NotificationStatus.BOUNCED;
    this.lastError = reason;

    if (!this.tracking) {
      this.tracking = {};
    }
    if (!this.tracking.bounces) {
      this.tracking.bounces = [];
    }

    this.tracking.bounces.push({
      timestamp: new Date(),
      type: 'hard',
      reason,
    });
  }

  recordDeliveryAttempt(status: NotificationStatus, error?: string, response?: any): void {
    if (!this.deliveryAttempts) {
      this.deliveryAttempts = [];
    }

    this.deliveryAttemptsCount++;
    this.deliveryAttempts.push({
      attemptNumber: this.deliveryAttemptsCount,
      timestamp: new Date(),
      status,
      error,
      response,
    });

    if (error) {
      this.lastError = error;
    }
  }

  recordOpen(ip?: string, userAgent?: string): void {
    this.openCount++;

    if (!this.openedAt) {
      this.openedAt = new Date();
      this.status = NotificationStatus.OPENED;
    }

    if (!this.tracking) {
      this.tracking = {};
    }
    if (!this.tracking.opens) {
      this.tracking.opens = [];
    }

    this.tracking.opens.push({
      timestamp: new Date(),
      ip,
      userAgent,
    });
  }

  recordClick(url: string, ip?: string, userAgent?: string): void {
    this.clickCount++;

    if (!this.clickedAt) {
      this.clickedAt = new Date();
      this.status = NotificationStatus.CLICKED;
    }

    if (!this.tracking) {
      this.tracking = {};
    }
    if (!this.tracking.clicks) {
      this.tracking.clicks = [];
    }

    this.tracking.clicks.push({
      timestamp: new Date(),
      url,
      ip,
      userAgent,
    });
  }

  shouldRetry(): boolean {
    // Don't retry if expired
    if (this.isExpired) return false;

    // Don't retry certain statuses
    if (
      [
        NotificationStatus.DELIVERED,
        NotificationStatus.BOUNCED,
        NotificationStatus.UNSUBSCRIBED,
      ].includes(this.status)
    ) {
      return false;
    }

    // Retry based on attempt count and priority
    const maxAttempts = this.priority === NotificationPriority.URGENT ? 5 : 3;
    return this.deliveryAttemptsCount < maxAttempts;
  }

  getRetryDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes

    const delay = Math.min(baseDelay * 2 ** (this.deliveryAttemptsCount - 1), maxDelay);

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);

    return Math.floor(delay + jitter);
  }
}
