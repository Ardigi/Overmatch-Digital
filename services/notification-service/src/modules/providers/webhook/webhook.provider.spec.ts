import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
// Manual instantiation - no TestingModule needed
import type { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { WebhookProvider } from './webhook.provider';

describe('WebhookProvider', () => {
  let provider: WebhookProvider;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig = {
    WEBHOOK_DEFAULT_URL: 'https://api.example.com/webhook',
    WEBHOOK_DEFAULT_HEADERS: 'Authorization:Bearer token123,X-Custom:value',
    WEBHOOK_DEFAULT_METHOD: 'POST',
    WEBHOOK_TIMEOUT: 30000,
    WEBHOOK_RETRY_ATTEMPTS: 3,
    WEBHOOK_SIGNATURE_SECRET: 'test-secret',
    WEBHOOK_SIGNATURE_HEADER: 'X-Webhook-Signature',
  };

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        return mockConfig[key] || defaultValue;
      }),
    };

    // Manual instantiation to avoid dependency injection issues
    provider = new WebhookProvider(mockConfigService as any, mockHttpService as any);
    httpService = mockHttpService as any;
    configService = mockConfigService as any;
  });

  describe('send', () => {
    it('should send webhook successfully with default configuration', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await provider.send('user@example.com', 'Test Subject', 'Test content');

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.providerMessageId).toMatch(/^webhook-\d+-[a-z0-9]+$/);

      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.WEBHOOK_DEFAULT_URL,
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          content: 'Test content',
          timestamp: expect.any(String),
          messageId: expect.any(String),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom': 'value',
            'X-Webhook-Signature': expect.stringMatching(/^sha256=[a-f0-9]+$/),
          }),
          timeout: 30000,
        })
      );
    });

    it('should use custom URL and headers when provided', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const options = {
        url: 'https://custom.webhook.com/notify',
        headers: {
          'X-API-Key': 'custom-key',
        },
        metadata: {
          userId: '123',
          priority: 'high',
        },
      };

      await provider.send('user@example.com', 'Test Subject', 'Test content', options);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://custom.webhook.com/notify',
        expect.objectContaining({
          metadata: {
            userId: '123',
            priority: 'high',
          },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'custom-key',
          }),
        })
      );
    });

    it('should merge custom payload when provided', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const options = {
        customPayload: {
          channel: 'alerts',
          severity: 'high',
          tags: ['urgent', 'compliance'],
        },
      };

      await provider.send('user@example.com', 'Test Subject', 'Test content', options);

      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.WEBHOOK_DEFAULT_URL,
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          content: 'Test content',
          channel: 'alerts',
          severity: 'high',
          tags: ['urgent', 'compliance'],
        }),
        expect.any(Object)
      );
    });

    it('should support different HTTP methods', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.put.mockReturnValue(of(mockResponse));

      await provider.send('user@example.com', 'Test Subject', 'Test content', { method: 'PUT' });

      expect(httpService.put).toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValueOnce(
          of({
            data: { success: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          })
        );

      const result = await provider.send('user@example.com', 'Test Subject', 'Test content');

      expect(result.success).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      const result = await provider.send('user@example.com', 'Test Subject', 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should fail when no URL is provided', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_DEFAULT_URL') return undefined;
        return mockConfig[key] || defaultValue;
      });

      // Re-instantiate provider with new config to get undefined default URL
      provider = new WebhookProvider(configService as any, httpService as any);

      const result = await provider.send('user@example.com', 'Test Subject', 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook URL not provided');
    });
  });

  describe('sendBulk', () => {
    it('should send individual webhooks when bulk URL not configured', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const recipients = [
        { to: 'user1@example.com', subject: 'Subject 1', content: 'Content 1' },
        { to: 'user2@example.com', subject: 'Subject 2', content: 'Content 2' },
      ];

      const results = await provider.sendBulk(recipients);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });

    it('should use bulk endpoint when configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_BULK_URL') return 'https://api.example.com/bulk';
        return mockConfig[key] || defaultValue;
      });

      const mockResponse: AxiosResponse = {
        data: { success: true, processed: 2 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const recipients = [
        { to: 'user1@example.com', subject: 'Subject 1', content: 'Content 1' },
        { to: 'user2@example.com', subject: 'Subject 2', content: 'Content 2' },
      ];

      const results = await provider.sendBulk(recipients);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.example.com/bulk',
        expect.objectContaining({
          batchId: expect.stringMatching(/^webhook-batch-\d+$/),
          notifications: expect.arrayContaining([
            expect.objectContaining({
              to: 'user1@example.com',
              subject: 'Subject 1',
            }),
          ]),
        }),
        expect.any(Object)
      );
    });
  });

  describe('getStatus', () => {
    it('should get status when endpoint configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_STATUS_URL') return 'https://api.example.com/status';
        return mockConfig[key] || defaultValue;
      });

      const mockResponse: AxiosResponse = {
        data: { status: 'delivered', timestamp: '2023-01-01T00:00:00Z' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const status = await provider.getStatus('webhook-123456');

      expect(status).toBe('delivered');
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.example.com/status/webhook-123456',
        expect.any(Object)
      );
    });

    it('should return unknown when status endpoint not configured', async () => {
      const status = await provider.getStatus('webhook-123456');

      expect(status).toBe('unknown');
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.WEBHOOK_DEFAULT_URL,
        expect.objectContaining({
          test: true,
          provider: 'webhook',
        }),
        expect.any(Object)
      );
    });

    it('should use test URL when configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_TEST_URL') return 'https://test.webhook.com/validate';
        return mockConfig[key] || defaultValue;
      });

      const mockResponse: AxiosResponse = {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      await provider.validateConfig();

      expect(httpService.post).toHaveBeenCalledWith(
        'https://test.webhook.com/validate',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should fail validation when no URL configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_DEFAULT_URL') return undefined;
        if (key === 'WEBHOOK_TEST_URL') return undefined;
        return mockConfig[key] || defaultValue;
      });

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(false);
    });
  });

  describe('signature generation', () => {
    it('should not add signature when secret not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_SIGNATURE_SECRET') return undefined;
        return mockConfig[key] || defaultValue;
      });

      // Re-instantiate provider with new config to get undefined signature secret
      provider = new WebhookProvider(configService as any, httpService as any);

      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      await provider.send('user@example.com', 'Test', 'Content');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'X-Webhook-Signature': expect.any(String),
          }),
        })
      );
    });
  });
});
