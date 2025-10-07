import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bull';
import { Repository } from 'typeorm';
import { KafkaService } from '../../kafka/kafka.service';
import type { EmailProviderService } from '../../providers/email/email.provider';
import type { InAppProviderService } from '../../providers/in-app/in-app.provider';
import type { PushProviderService } from '../../providers/push/push.provider';
import type { SlackProviderService } from '../../providers/slack/slack.provider';
import type { SmsProviderService } from '../../providers/sms/sms.provider';
import type { TeamsProvider } from '../../providers/teams/teams.provider';
import type { WebhookProvider } from '../../providers/webhook/webhook.provider';
import { Notification, NotificationChannel, NotificationStatus } from '../entities/notification.entity';

interface NotificationJobData {
  notificationId: string;
  organizationId: string;
  retryCount?: number;
}

@Processor('notifications')
@Injectable()
export class NotificationQueueProcessor {
  private readonly logger = new Logger(NotificationQueueProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue<NotificationJobData>,
    private readonly emailProvider: EmailProviderService,
    private readonly smsProvider: SmsProviderService,
    private readonly slackProvider: SlackProviderService,
    private readonly inAppProvider: InAppProviderService,
    private readonly pushProvider: PushProviderService,
    private readonly teamsProvider: TeamsProvider,
    private readonly webhookProvider: WebhookProvider,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {}

  @Process('send-notification')
  async handleSendNotification(job: Job<NotificationJobData>) {
    const { notificationId, organizationId, retryCount = 0 } = job.data;

    try {
      this.logger.log(`Processing notification ${notificationId}`);

      // Fetch notification
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, organizationId },
      });

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Check if already processed
      if ([NotificationStatus.SENT, NotificationStatus.DELIVERED].includes(notification.status)) {
        this.logger.warn(`Notification ${notificationId} already processed`);
        return;
      }

      // Check if expired
      if (notification.isExpired) {
        await this.markAsExpired(notification);
        return;
      }

      // Mark as sending
      notification.markAsSending();
      await this.notificationRepository.save(notification);

      // Send notification based on channel
      const result = await this.sendNotification(notification);

      if (result.success) {
        // Mark as sent/delivered
        notification.markAsSent(result.providerMessageId, result.providerResponse);
        if (result.status === 'delivered') {
          notification.markAsDelivered();
        }
        await this.notificationRepository.save(notification);

        // Emit success event
        await this.kafkaService.emit('notification.sent', {
          notificationId: notification.id,
          organizationId: notification.organizationId,
          channel: notification.channel,
          providerMessageId: result.providerMessageId,
        });

        this.logger.log(`Notification ${notificationId} sent successfully`);
      } else {
        // Handle failure
        await this.handleFailure(notification, result.error, job);
      }
    } catch (error) {
      this.logger.error(`Failed to process notification ${notificationId}:`, error);
      
      // Fetch notification again to ensure we have latest state
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, organizationId },
      });
      
      if (notification) {
        await this.handleFailure(notification, error.message, job);
      }
      
      throw error; // Let Bull handle retry
    }
  }

  @Process('send-batch')
  async handleSendBatch(job: Job<{ batchId: string; organizationId: string }>) {
    const { batchId, organizationId } = job.data;

    try {
      this.logger.log(`Processing batch ${batchId}`);

      // Fetch all notifications in batch
      const notifications = await this.notificationRepository.find({
        where: {
          batchId,
          organizationId,
          status: NotificationStatus.PENDING,
        },
      });

      this.logger.log(`Found ${notifications.length} notifications in batch ${batchId}`);

      // Queue each notification
      for (const notification of notifications) {
        await this.notificationQueue.add('send-notification', {
          notificationId: notification.id,
          organizationId: notification.organizationId,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process batch ${batchId}:`, error);
      throw error;
    }
  }

  private async sendNotification(notification: Notification): Promise<any> {
    switch (notification.channel) {
      case NotificationChannel.EMAIL:
        return this.emailProvider.send({
          to: notification.recipient.email,
          subject: notification.content.subject,
          html: notification.content.body,
          templateId: notification.content.templateId,
          templateData: notification.content.templateData,
          metadata: {
            organizationId: notification.organizationId,
            notificationId: notification.id,
            ...notification.content.metadata,
          },
        });

      case NotificationChannel.SMS:
        if (!notification.recipient.phone) {
          throw new Error('SMS recipient missing phone number');
        }
        return this.smsProvider.send(
          { ...notification.recipient, phone: notification.recipient.phone },
          {
            body: notification.content.smsBody || notification.content.body,
          },
          {
            organizationId: notification.organizationId,
            notificationId: notification.id,
          },
        );

      case NotificationChannel.SLACK:
        return this.slackProvider.send(
          notification.recipient,
          {
            text: notification.content.body,
            blocks: notification.content.slackBlocks,
          },
          {
            organizationId: notification.organizationId,
            notificationId: notification.id,
          },
        );

      case NotificationChannel.IN_APP:
        if (!notification.recipient.userId) {
          throw new Error('In-app recipient missing userId');
        }
        return this.inAppProvider.send(
          { ...notification.recipient, userId: notification.recipient.userId },
          {
            title: notification.content.subject || 'Notification',
            body: notification.content.body,
            data: notification.variables,
            priority: notification.priority,
            category: notification.category,
          },
          {
            organizationId: notification.organizationId,
            notificationId: notification.id,
            expiresAt: notification.expiresAt,
          },
        );

      case NotificationChannel.TEAMS:
        if (!notification.recipient.webhookUrl) {
          throw new Error('Teams recipient missing webhook URL');
        }
        return this.teamsProvider.send(
          notification.recipient.webhookUrl,
          notification.content.subject || notification.type,
          notification.content.body,
          {
            ...notification.variables,
            metadata: notification.metadata,
            priority: notification.priority,
            category: notification.category,
          },
        );

      case NotificationChannel.WEBHOOK:
        if (!notification.recipient.webhookUrl) {
          throw new Error('Webhook recipient missing webhook URL');
        }
        return this.webhookProvider.send(
          notification.recipient.webhookUrl,
          notification.content.subject || notification.type,
          notification.content.body,
          {
            method: notification.metadata?.webhookMethod,
            headers: notification.metadata?.webhookHeaders,
            customPayload: notification.metadata?.customPayload,
            metadata: {
              notificationId: notification.id,
              organizationId: notification.organizationId,
              type: notification.type,
              priority: notification.priority,
              category: notification.category,
              ...notification.variables,
            },
          },
        );

      default:
        throw new Error(`Unknown notification channel: ${notification.channel}`);
    }
  }

  private async handleFailure(
    notification: Notification,
    error: string,
    job: Job<NotificationJobData>,
  ): Promise<void> {
    // Record delivery attempt
    notification.recordDeliveryAttempt(NotificationStatus.FAILED, error);

    // Check if should retry
    const maxRetries = this.getMaxRetries(notification);
    const currentAttempt = job.data.retryCount || 0;

    if (currentAttempt < maxRetries && !notification.isExpired) {
      // Will be retried by Bull
      this.logger.warn(
        `Notification ${notification.id} failed, will retry (attempt ${currentAttempt + 1}/${maxRetries})`,
      );
      await this.notificationRepository.save(notification);
    } else {
      // Mark as permanently failed
      notification.markAsFailed(error);
      await this.notificationRepository.save(notification);

      // Emit failure event
      await this.kafkaService.emit('notification.failed', {
        notificationId: notification.id,
        organizationId: notification.organizationId,
        channel: notification.channel,
        error,
        attempts: notification.deliveryAttemptsCount,
      });

      this.logger.error(
        `Notification ${notification.id} permanently failed after ${notification.deliveryAttemptsCount} attempts`,
      );
    }
  }

  private async markAsExpired(notification: Notification): Promise<void> {
    notification.status = NotificationStatus.EXPIRED;
    await this.notificationRepository.save(notification);

    await this.kafkaService.emit('notification.expired', {
      notificationId: notification.id,
      organizationId: notification.organizationId,
      channel: notification.channel,
    });

    this.logger.warn(`Notification ${notification.id} expired`);
  }

  private getMaxRetries(notification: Notification): number {
    // Priority-based retry logic
    switch (notification.priority) {
      case 'urgent':
        return 5;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 2;
    }
  }

  // Scheduled job processors
  @Process('cleanup-expired')
  async handleCleanupExpired(job: Job) {
    try {
      this.logger.log('Starting expired notifications cleanup');

      const result = await this.notificationRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ status: NotificationStatus.EXPIRED })
        .where('expiresAt < :now', { now: new Date() })
        .andWhere('status IN (:...statuses)', {
          statuses: [NotificationStatus.PENDING, NotificationStatus.QUEUED],
        })
        .execute();

      this.logger.log(`Marked ${result.affected} notifications as expired`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications:', error);
      throw error;
    }
  }

  @Process('generate-report')
  async handleGenerateReport(job: Job<{ organizationId: string; period: string }>) {
    const { organizationId, period } = job.data;

    try {
      this.logger.log(`Generating notification report for ${organizationId} - Period: ${period}`);

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarterly':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7); // Default to weekly
      }

      // Generate notification statistics
      const stats = await this.notificationRepository
        .createQueryBuilder('notification')
        .select([
          'notification.channel as channel',
          'notification.status as status',
          'COUNT(*) as count',
          'AVG(notification.deliveryAttempts) as avgAttempts',
        ])
        .where('notification.organizationId = :organizationId', { organizationId })
        .andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('notification.channel, notification.status')
        .getRawMany();

      // Get engagement metrics
      const engagement = await this.notificationRepository
        .createQueryBuilder('notification')
        .select([
          'notification.channel as channel',
          'COUNT(CASE WHEN notification.openedAt IS NOT NULL THEN 1 END) as opened',
          'COUNT(CASE WHEN notification.clickedAt IS NOT NULL THEN 1 END) as clicked',
          'COUNT(*) as total',
        ])
        .where('notification.organizationId = :organizationId', { organizationId })
        .andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('notification.channel')
        .getRawMany();

      // Get top notification types
      const topTypes = await this.notificationRepository
        .createQueryBuilder('notification')
        .select([
          'notification.type as type',
          'COUNT(*) as count',
        ])
        .where('notification.organizationId = :organizationId', { organizationId })
        .andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('notification.type')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany();

      // Compile report data
      const reportData = {
        organizationId,
        period,
        startDate,
        endDate,
        generatedAt: new Date(),
        statistics: {
          byChannel: this.aggregateByChannel(stats),
          byStatus: this.aggregateByStatus(stats),
          totalNotifications: stats.reduce((sum, s) => sum + parseInt(s.count), 0),
        },
        engagement: {
          byChannel: engagement.map(e => ({
            channel: e.channel,
            openRate: e.total > 0 ? (e.opened / e.total) * 100 : 0,
            clickRate: e.total > 0 ? (e.clicked / e.total) * 100 : 0,
            totalSent: parseInt(e.total),
          })),
        },
        topNotificationTypes: topTypes.map(t => ({
          type: t.type,
          count: parseInt(t.count),
        })),
      };

      // Emit report generated event
      await this.kafkaService.emit('notification.report.generated', {
        organizationId,
        period,
        reportData,
        timestamp: new Date(),
      });

      this.logger.log(`Notification report generated for ${organizationId}`);
      return reportData;
    } catch (error) {
      this.logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  private aggregateByChannel(stats: any[]): Record<string, any> {
    const byChannel = {};
    stats.forEach(stat => {
      if (!byChannel[stat.channel]) {
        byChannel[stat.channel] = {
          total: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          avgAttempts: 0,
        };
      }
      byChannel[stat.channel].total += parseInt(stat.count);
      if (stat.status === 'sent' || stat.status === 'delivered') {
        byChannel[stat.channel].sent += parseInt(stat.count);
      }
      if (stat.status === 'delivered') {
        byChannel[stat.channel].delivered += parseInt(stat.count);
      }
      if (stat.status === 'failed') {
        byChannel[stat.channel].failed += parseInt(stat.count);
      }
      byChannel[stat.channel].avgAttempts = parseFloat(stat.avgAttempts) || 0;
    });
    return byChannel;
  }

  private aggregateByStatus(stats: any[]): Record<string, number> {
    const byStatus = {};
    stats.forEach(stat => {
      if (!byStatus[stat.status]) {
        byStatus[stat.status] = 0;
      }
      byStatus[stat.status] += parseInt(stat.count);
    });
    return byStatus;
  }
}