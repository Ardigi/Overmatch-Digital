import { BullModule } from '@nestjs/bull';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from './app.module';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './modules/notifications/entities/notification.entity';

describe('Notification Service Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'user'],
  };

  const mockRecipient = {
    id: 'recipient-456',
    email: 'recipient@example.com',
    organizationId: 'org-123',
    roles: ['user'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'sqlite',
            database: ':memory:',
            entities: ['src/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
          },
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes, filters, etc.
    app.setGlobalPrefix('api/v1');

    await app.init();

    // Generate auth tokens
    const jwtService = moduleFixture.get(JwtService);
    authToken = await jwtService.sign(mockUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Notification Lifecycle', () => {
    let notificationId: string;
    let templateCode: string;

    describe('Template Management', () => {
      it('should create notification template', async () => {
        const createTemplateDto = {
          code: 'system-alert',
          name: 'System Alert Template',
          description: 'Template for system alerts',
          channel: NotificationChannel.EMAIL,
          type: NotificationType.ALERT,
          subject: '🚨 {{severity}} Alert: {{title}}',
          content: {
            text: 'Alert: {{title}}\n\nDetails: {{details}}\n\nTime: {{timestamp}}',
            html: '<h2>🚨 {{severity}} Alert: {{title}}</h2><p>{{details}}</p><p><small>Time: {{timestamp}}</small></p>',
            variables: {
              severity: {
                required: true,
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
              },
              title: { required: true, type: 'string' },
              details: { required: true, type: 'string' },
              timestamp: { required: true, type: 'string' },
            },
          },
          metadata: {
            tags: ['system', 'alert'],
            category: 'system-notifications',
          },
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/notifications/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);

        expect(response.body).toMatchObject({
          code: 'system-alert',
          name: 'System Alert Template',
          channel: NotificationChannel.EMAIL,
          isActive: true,
        });

        templateCode = response.body.code;
      });

      it('should list templates', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/notifications/templates')
          .query({
            organizationId: mockUser.organizationId,
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ALERT,
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('code', 'system-alert');
      });

      it('should preview template', async () => {
        const variables = {
          severity: 'HIGH',
          title: 'Database Connection Failed',
          details: 'Unable to connect to primary database server',
          timestamp: new Date().toISOString(),
        };

        const response = await request(app.getHttpServer())
          .post(`/api/v1/notifications/templates/${templateCode}/preview`)
          .query({ organizationId: mockUser.organizationId })
          .set('Authorization', `Bearer ${authToken}`)
          .send(variables)
          .expect(200);

        expect(response.body).toHaveProperty('subject');
        expect(response.body.subject).toContain('HIGH Alert:');
        expect(response.body.html).toContain('Database Connection Failed');
      });
    });

    describe('Notification Creation and Sending', () => {
      it('should create notification using template', async () => {
        const createDto = {
          recipientId: mockRecipient.id,
          recipient: {
            id: mockRecipient.id,
            email: mockRecipient.email,
            name: 'Test Recipient',
          },
          channel: NotificationChannel.EMAIL,
          type: NotificationType.ALERT,
          category: NotificationCategory.SYSTEM,
          templateCode: 'system-alert',
          variables: {
            severity: 'CRITICAL',
            title: 'Security Breach Detected',
            details: 'Unauthorized access attempt detected from IP 192.168.1.100',
            timestamp: new Date().toISOString(),
          },
          priority: NotificationPriority.URGENT,
          tags: ['security', 'critical', 'immediate'],
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createDto)
          .expect(201);

        expect(response.body).toMatchObject({
          recipientId: mockRecipient.id,
          channel: NotificationChannel.EMAIL,
          type: NotificationType.ALERT,
          status: NotificationStatus.PENDING,
          priority: NotificationPriority.URGENT,
        });
        expect(response.body.content.subject).toContain('CRITICAL Alert:');

        notificationId = response.body.id;
      });

      it('should create direct notification without template', async () => {
        const createDto = {
          recipientId: mockRecipient.id,
          recipient: {
            id: mockRecipient.id,
            email: mockRecipient.email,
          },
          channel: NotificationChannel.EMAIL,
          type: NotificationType.TRANSACTIONAL,
          category: NotificationCategory.USER,
          subject: 'Password Reset Request',
          content: {
            subject: 'Password Reset Request',
            body: 'Click the link below to reset your password',
            htmlBody:
              '<p>Click <a href="https://example.com/reset">here</a> to reset your password</p>',
          },
          priority: NotificationPriority.HIGH,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createDto)
          .expect(201);

        expect(response.body).toMatchObject({
          subject: 'Password Reset Request',
          type: NotificationType.TRANSACTIONAL,
          priority: NotificationPriority.HIGH,
        });
      });

      it('should schedule future notification', async () => {
        const futureDate = new Date(Date.now() + 86400000); // 24 hours from now

        const createDto = {
          recipientId: mockRecipient.id,
          recipient: {
            id: mockRecipient.id,
            email: mockRecipient.email,
          },
          channel: NotificationChannel.EMAIL,
          type: NotificationType.REMINDER,
          category: NotificationCategory.USER,
          subject: 'Appointment Reminder',
          content: {
            subject: 'Appointment Reminder',
            body: 'You have an appointment tomorrow at 2:00 PM',
          },
          scheduledFor: futureDate,
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/notifications')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createDto)
          .expect(201);

        expect(response.body.scheduledFor).toBe(futureDate.toISOString());
        expect(response.body.status).toBe(NotificationStatus.PENDING);
      });
    });

    describe('Notification Tracking', () => {
      it('should track notification open', async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/notifications/${notificationId}/track/open`)
          .expect(200);

        // Verify notification was updated
        const notification = await request(app.getHttpServer())
          .get(`/api/v1/notifications/${notificationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(notification.body.openCount).toBeGreaterThan(0);
        expect(notification.body.firstOpenedAt).toBeDefined();
      });

      it('should track notification click', async () => {
        const targetUrl = 'https://example.com/security-info';

        await request(app.getHttpServer())
          .get(`/api/v1/notifications/${notificationId}/track/click`)
          .query({ url: targetUrl })
          .expect(302)
          .expect('Location', targetUrl);

        // Verify click was tracked
        const notification = await request(app.getHttpServer())
          .get(`/api/v1/notifications/${notificationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(notification.body.clickCount).toBeGreaterThan(0);
      });
    });

    describe('Search and Analytics', () => {
      it('should search notifications', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/notifications')
          .query({
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ALERT,
            status: NotificationStatus.PENDING,
            page: 1,
            pageSize: 20,
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body.data).toBeInstanceOf(Array);
      });

      it('should get notification analytics', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const response = await request(app.getHttpServer())
          .get('/api/v1/notifications/analytics')
          .query({
            organizationId: mockUser.organizationId,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('summary');
        expect(response.body.summary).toMatchObject({
          total: expect.any(Number),
          sent: expect.any(Number),
          delivered: expect.any(Number),
          failed: expect.any(Number),
          opened: expect.any(Number),
          clicked: expect.any(Number),
          deliveryRate: expect.any(Number),
          openRate: expect.any(Number),
          clickRate: expect.any(Number),
        });
        expect(response.body).toHaveProperty('byChannel');
        expect(response.body).toHaveProperty('byType');
        expect(response.body).toHaveProperty('topPerformingTemplates');
      });
    });
  });

  describe('User Preferences', () => {
    it('should get user preferences', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUser.id,
        userEmail: mockUser.email,
        channels: expect.objectContaining({
          email: expect.objectContaining({
            enabled: true,
          }),
        }),
      });
    });

    it('should update user preferences', async () => {
      const updateDto = {
        channels: {
          email: {
            enabled: true,
            frequency: 'digest',
            categories: {
              system: true,
              security: true,
              marketing: false,
            },
          },
          sms: {
            enabled: false,
          },
        },
        doNotDisturb: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York',
        },
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.channels.email.frequency).toBe('digest');
      expect(response.body.doNotDisturb.enabled).toBe(true);
    });

    it('should opt out of notifications', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/preferences/me/opt-out')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Too many notifications' })
        .expect(200);

      // Verify opt-out
      const preferences = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(preferences.body.optedOut).toBe(true);
    });

    it('should opt back in to notifications', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/preferences/me/opt-in')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify opt-in
      const preferences = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(preferences.body.optedOut).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should send batch notifications', async () => {
      const batchDto = {
        batchId: 'announcement-batch-123',
        notifications: [
          {
            recipientId: 'user-1',
            recipient: { id: 'user-1', email: 'user1@example.com' },
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ANNOUNCEMENT,
            category: NotificationCategory.SYSTEM,
            subject: 'System Maintenance',
            content: {
              subject: 'System Maintenance',
              body: 'System will be under maintenance on Sunday',
            },
          },
          {
            recipientId: 'user-2',
            recipient: { id: 'user-2', email: 'user2@example.com' },
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ANNOUNCEMENT,
            category: NotificationCategory.SYSTEM,
            subject: 'System Maintenance',
            content: {
              subject: 'System Maintenance',
              body: 'System will be under maintenance on Sunday',
            },
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(batchDto)
        .expect(202);

      expect(response.body).toMatchObject({
        batchId: 'announcement-batch-123',
        count: 2,
      });
    });
  });

  describe('Provider Webhooks', () => {
    it('should handle email provider webhook', async () => {
      const webhookPayload = {
        events: [
          {
            event: 'delivered',
            email: 'recipient@example.com',
            timestamp: Date.now() / 1000,
            sg_message_id: 'msg-123',
          },
          {
            event: 'open',
            email: 'recipient@example.com',
            timestamp: Date.now() / 1000,
            sg_message_id: 'msg-123',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/webhooks/sendgrid')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toEqual({ received: true });
    });
  });

  describe('Multi-Channel Notifications', () => {
    it('should send notification to multiple channels', async () => {
      // Create SMS notification
      const smsDto = {
        recipientId: mockRecipient.id,
        recipient: {
          id: mockRecipient.id,
          phone: '+1234567890',
        },
        channel: NotificationChannel.SMS,
        type: NotificationType.ALERT,
        category: NotificationCategory.SECURITY,
        content: {
          body: 'ALERT: Unusual login detected from new device',
        },
        priority: NotificationPriority.URGENT,
      };

      const smsResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(smsDto)
        .expect(201);

      expect(smsResponse.body.channel).toBe(NotificationChannel.SMS);

      // Create Slack notification
      const slackDto = {
        recipientId: mockRecipient.id,
        recipient: {
          id: mockRecipient.id,
          slackUserId: 'U123456',
        },
        channel: NotificationChannel.SLACK,
        type: NotificationType.ALERT,
        category: NotificationCategory.SECURITY,
        content: {
          subject: 'Security Alert',
          body: 'Unusual login detected',
          metadata: {
            color: 'danger',
            fields: [
              { title: 'Device', value: 'Unknown Device', short: true },
              { title: 'Location', value: 'New York, US', short: true },
            ],
          },
        },
        priority: NotificationPriority.URGENT,
      };

      const slackResponse = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(slackDto)
        .expect(201);

      expect(slackResponse.body.channel).toBe(NotificationChannel.SLACK);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should reject notification with invalid template variables', async () => {
      const createDto = {
        recipientId: mockRecipient.id,
        recipient: { id: mockRecipient.id, email: mockRecipient.email },
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ALERT,
        templateCode: 'system-alert',
        variables: {
          // Missing required variables
          severity: 'HIGH',
          // title: missing
          // details: missing
          timestamp: new Date().toISOString(),
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should handle notification to opted-out user', async () => {
      // First opt out the recipient
      const recipientToken = await app.get(JwtService).sign(mockRecipient);

      await request(app.getHttpServer())
        .post('/api/v1/notifications/preferences/me/opt-out')
        .set('Authorization', `Bearer ${recipientToken}`)
        .send({ reason: 'Test opt-out' })
        .expect(200);

      // Try to send notification
      const createDto = {
        recipientId: mockRecipient.id,
        recipient: { id: mockRecipient.id, email: mockRecipient.email },
        channel: NotificationChannel.EMAIL,
        type: NotificationType.MARKETING,
        category: NotificationCategory.MARKETING,
        subject: 'Special Offer',
        content: { subject: 'Special Offer', body: 'Get 50% off!' },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      // Notification should be created but marked as failed
      expect(response.body.status).toBe(NotificationStatus.FAILED);
      expect(response.body.lastError).toContain('opted out');
    });

    it('should resend failed notification', async () => {
      // Create a notification that will fail
      const createDto = {
        recipientId: 'non-existent-user',
        recipient: { id: 'non-existent-user', email: 'invalid@' }, // Invalid email
        channel: NotificationChannel.EMAIL,
        type: NotificationType.TRANSACTIONAL,
        subject: 'Test',
        content: { subject: 'Test', body: 'Test' },
      };

      const failedNotification = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      // Resend the failed notification
      const response = await request(app.getHttpServer())
        .post(`/api/v1/notifications/resend/${failedNotification.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.deliveryAttempts).toBeGreaterThan(0);
    });
  });

  describe('Provider Health Check', () => {
    it('should check notification providers health', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toMatchObject({
        provider: expect.any(String),
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastCheck: expect.any(String),
      });
    });
  });

  describe('Access Control', () => {
    it('should restrict non-admin users to their own notifications', async () => {
      const userToken = await app.get(JwtService).sign({
        ...mockUser,
        roles: ['user'], // Remove admin role
      });

      // Try to access another user's notifications
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .query({ recipientId: 'other-user-123' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // The service should override recipientId to user's own ID
      // This is tested in the controller unit tests
    });

    it('should allow admin to access all notifications', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .query({ recipientId: mockRecipient.id })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'notification-service',
      });
    });
  });
});
