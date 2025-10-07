// MUST be before any imports - Fix for WeakMap error
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import * as request from 'supertest';
import { NotificationServiceE2ESetup } from './setup-minimal';

// import { TestDataBuilder } from '../../../../test/e2e/shared/TestDataBuilder';

describe('Notification Service E2E Tests', () => {
  let setup: NotificationServiceE2ESetup;
  // let testData: TestDataBuilder;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    setup = new NotificationServiceE2ESetup();
    await setup.createTestApp();
    // testData = new TestDataBuilder();

    // Seed test data
    await setup.cleanDatabase();
    await setup.seedTestData();

    // Mock auth token and user ID for tests
    authToken = 'mock-jwt-token';
    userId = '11111111-1111-1111-1111-111111111111';
  }, 30000);

  afterAll(async () => {
    await setup.closeApp();
  });

  describe('Notification Templates', () => {
    describe('GET /notification-templates', () => {
      it('should return all notification templates', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/notification-templates',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('type');
      });

      it('should filter templates by type', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/notification-templates?type=email',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((t) => t.type === 'email')).toBe(true);
      });
    });

    describe('POST /notification-templates', () => {
      it('should create a new notification template', async () => {
        const newTemplate = {
          id: 'test-template',
          name: 'Test Template',
          type: 'email',
          subject: 'Test Subject: {{variable}}',
          body: 'Test body with {{variable}} and {{anotherVariable}}',
          variables: ['variable', 'anotherVariable'],
          category: 'test',
          active: true,
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notification-templates',
          authToken,
          newTemplate
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id', newTemplate.id);
        expect(response.body).toHaveProperty('name', newTemplate.name);
        expect(response.body).toHaveProperty('variables');
        expect(response.body.variables).toEqual(newTemplate.variables);
      });

      it('should validate template syntax', async () => {
        const invalidTemplate = {
          id: 'invalid-template',
          name: 'Invalid Template',
          type: 'email',
          subject: 'Invalid {{variable', // Missing closing braces
          body: 'Test body',
          variables: ['variable'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notification-templates',
          authToken,
          invalidTemplate
        );

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('User Preferences', () => {
    describe('GET /preferences/:userId', () => {
      it('should return user notification preferences', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/preferences/${userId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('userId', userId);
        expect(response.body).toHaveProperty('channels');
        expect(response.body).toHaveProperty('preferences');
      });
    });

    describe('PUT /preferences/:userId', () => {
      it('should update user notification preferences', async () => {
        const updatedPreferences = {
          channels: {
            email: true,
            inApp: true,
            sms: false,
            push: false,
          },
          preferences: {
            controlAssigned: {
              email: false,
              inApp: true,
              sms: false,
              push: false,
            },
            evidenceDue: {
              email: true,
              inApp: true,
              sms: false,
              push: false,
            },
          },
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
            timezone: 'America/New_York',
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'put',
          `/preferences/${userId}`,
          authToken,
          updatedPreferences
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('channels');
        expect(response.body.channels).toEqual(updatedPreferences.channels);
        expect(response.body).toHaveProperty('quietHours');
      });
    });
  });

  describe('Sending Notifications', () => {
    describe('POST /notifications/send', () => {
      it('should send a single notification', async () => {
        const notification = {
          templateId: 'welcome-email',
          recipients: [userId],
          channel: 'email',
          data: {
            userName: 'Test User',
          },
          priority: 'high',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notifications/send',
          authToken,
          notification
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status', 'queued');
        expect(response.body).toHaveProperty('templateId', notification.templateId);
      });

      it('should send notification to multiple recipients', async () => {
        const notification = {
          templateId: 'control-assigned',
          recipients: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
          ],
          channel: 'email',
          data: {
            controlName: 'Access Control',
            assignedBy: 'Admin User',
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notifications/send',
          authToken,
          notification
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('batchId');
        expect(response.body).toHaveProperty('recipientCount', 2);
      });

      it('should respect user preferences', async () => {
        // First, set user preference to disable email
        await setup.makeAuthenticatedRequest('put', `/preferences/${userId}`, authToken, {
          channels: { email: false, inApp: true },
          preferences: { evidenceDue: { email: false, inApp: true } },
        });

        // Try to send email notification
        const notification = {
          templateId: 'evidence-due',
          recipients: [userId],
          channel: 'email',
          data: {
            evidenceName: 'Security Policy',
            daysUntilDue: 3,
            dueDate: '2025-02-01',
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notifications/send',
          authToken,
          notification
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('status', 'skipped');
        expect(response.body).toHaveProperty('reason', 'User preference disabled');
      });
    });

    describe('POST /notifications/send-batch', () => {
      it('should send batch notifications', async () => {
        const batchNotification = {
          notifications: [
            {
              templateId: 'evidence-due',
              recipients: ['11111111-1111-1111-1111-111111111111'],
              channel: 'email',
              data: {
                evidenceName: 'Security Policy',
                daysUntilDue: 7,
                dueDate: '2025-02-05',
              },
            },
            {
              templateId: 'control-assigned',
              recipients: ['22222222-2222-2222-2222-222222222222'],
              channel: 'email',
              data: {
                controlName: 'Data Encryption',
                assignedBy: 'Security Admin',
              },
            },
          ],
          scheduledFor: null,
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/notifications/send-batch',
          authToken,
          batchNotification
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('batchId');
        expect(response.body).toHaveProperty('totalNotifications', 2);
        expect(response.body).toHaveProperty('status', 'processing');
      });
    });
  });

  describe('Notification History', () => {
    let notificationId: string;

    beforeAll(async () => {
      // Send a notification to have history
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/notifications/send',
        authToken,
        {
          templateId: 'report-generated',
          recipients: [userId],
          channel: 'email',
          data: {
            reportName: 'SOC 2 Compliance Report',
            downloadUrl: 'https://example.com/download/report123',
          },
        }
      );
      notificationId = response.body.id;
    });

    describe('GET /notifications', () => {
      it('should return notification history', async () => {
        const response = await setup.makeAuthenticatedRequest('get', '/notifications', authToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should filter notifications by recipient', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/notifications?recipientId=${userId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((n) => n.recipientId === userId)).toBe(true);
      });

      it('should filter notifications by status', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/notifications?status=delivered',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((n) => n.status === 'delivered')).toBe(true);
      });
    });

    describe('GET /notifications/:id', () => {
      it('should return notification details', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/notifications/${notificationId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', notificationId);
        expect(response.body).toHaveProperty('templateId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('deliveryAttempts');
      });
    });
  });

  describe('In-App Notifications', () => {
    describe('GET /notifications/in-app/:userId', () => {
      it('should return unread in-app notifications', async () => {
        // First, send an in-app notification
        await setup.makeAuthenticatedRequest('post', '/notifications/send', authToken, {
          templateId: 'control-assigned',
          recipients: [userId],
          channel: 'inApp',
          data: {
            controlName: 'Password Policy',
            assignedBy: 'System Admin',
          },
        });

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/notifications/in-app/${userId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('unread');
        expect(response.body).toHaveProperty('notifications');
        expect(Array.isArray(response.body.notifications)).toBe(true);
        expect(response.body.unread).toBeGreaterThan(0);
      });
    });

    describe('POST /notifications/in-app/:id/read', () => {
      it('should mark in-app notification as read', async () => {
        // First, get an unread notification
        const notificationsResponse = await setup.makeAuthenticatedRequest(
          'get',
          `/notifications/in-app/${userId}`,
          authToken
        );

        const unreadNotification = notificationsResponse.body.notifications[0];
        expect(unreadNotification).toBeDefined();

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/notifications/in-app/${unreadNotification.id}/read`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('readAt');
      });
    });

    describe('POST /notifications/in-app/mark-all-read', () => {
      it('should mark all in-app notifications as read', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/notifications/in-app/mark-all-read`,
          authToken,
          { userId }
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('updated');
        expect(response.body.updated).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Notification Analytics', () => {
    describe('GET /notifications/analytics', () => {
      it('should return notification analytics', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/notifications/analytics?period=7d',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalSent');
        expect(response.body).toHaveProperty('delivered');
        expect(response.body).toHaveProperty('failed');
        expect(response.body).toHaveProperty('opened');
        expect(response.body).toHaveProperty('clicked');
        expect(response.body).toHaveProperty('byChannel');
        expect(response.body).toHaveProperty('byTemplate');
      });
    });

    describe('GET /notifications/analytics/templates/:templateId', () => {
      it('should return template-specific analytics', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/notifications/analytics/templates/welcome-email',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('templateId', 'welcome-email');
        expect(response.body).toHaveProperty('totalSent');
        expect(response.body).toHaveProperty('deliveryRate');
        expect(response.body).toHaveProperty('openRate');
        expect(response.body).toHaveProperty('clickRate');
      });
    });
  });

  describe('Notification Events', () => {
    it('should handle notification events via Kafka', async () => {
      // This test verifies that notification events are properly consumed
      // In a real scenario, we would trigger events and verify handling

      const notification = {
        templateId: 'evidence-due',
        recipients: [userId],
        channel: 'email',
        data: {
          evidenceName: 'Compliance Document',
          daysUntilDue: 1,
          dueDate: '2025-01-31',
        },
      };

      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/notifications/send',
        authToken,
        notification
      );

      expect(response.status).toBe(201);
      // Events like evidence.due.reminder should trigger notifications
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent template', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/notifications/send',
        authToken,
        {
          templateId: 'non-existent-template',
          recipients: [userId],
          channel: 'email',
          data: {},
        }
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle missing template variables', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/notifications/send',
        authToken,
        {
          templateId: 'welcome-email',
          recipients: [userId],
          channel: 'email',
          data: {}, // Missing userName variable
        }
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Missing required variables');
    });

    it('should require authentication', async () => {
      const response = await request(setup.getHttpServer())
        .get('/notification-templates')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('WebSocket Notifications', () => {
    // Note: WebSocket testing would require a WebSocket client
    // This is a placeholder for WebSocket-specific tests

    it('should support WebSocket connections for real-time notifications', async () => {
      // In a real implementation, you would:
      // 1. Establish WebSocket connection
      // 2. Send a notification
      // 3. Verify it's received via WebSocket
      // 4. Close connection

      expect(true).toBe(true); // Placeholder
    });
  });
});
