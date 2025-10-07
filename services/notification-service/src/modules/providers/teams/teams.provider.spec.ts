import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
// Manual instantiation - no TestingModule needed
import type { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { TeamsProvider } from './teams.provider';

describe('TeamsProvider', () => {
  let provider: TeamsProvider;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig = {
    TEAMS_WEBHOOK_URL: 'https://outlook.office.com/webhook/test',
    TEAMS_DEFAULT_COLOR: '0078D4',
    TEAMS_ENABLE_MARKDOWN: true,
  };

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        return mockConfig[key] || defaultValue;
      }),
    };

    // Manual instantiation to avoid dependency injection issues
    provider = new TeamsProvider(mockConfigService as any, mockHttpService as any);
    httpService = mockHttpService as any;
    configService = mockConfigService as any;
  });

  describe('send', () => {
    it('should send a basic notification successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: 1,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await provider.send('test-channel', 'Test Subject', 'Test content');

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.providerMessageId).toContain('teams-');

      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.TEAMS_WEBHOOK_URL,
        expect.objectContaining({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: 'Test Subject',
          themeColor: '0078D4',
          sections: [
            {
              activityTitle: 'Test Subject',
              text: 'Test content',
              markdown: true,
            },
          ],
        })
      );
    });

    it('should include optional elements when provided', async () => {
      const mockResponse: AxiosResponse = {
        data: 1,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const options = {
        subtitle: 'Test Subtitle',
        image: 'https://example.com/image.png',
        themeColor: 'FF0000',
        facts: [
          { name: 'Status', value: 'Active' },
          { name: 'Priority', value: 'High' },
        ],
        actions: [{ name: 'View Details', url: 'https://example.com/details' }],
      };

      await provider.send('test-channel', 'Test Subject', 'Test content', options);

      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.TEAMS_WEBHOOK_URL,
        expect.objectContaining({
          themeColor: 'FF0000',
          sections: expect.arrayContaining([
            expect.objectContaining({
              activityTitle: 'Test Subject',
              activitySubtitle: 'Test Subtitle',
              activityImage: 'https://example.com/image.png',
              text: 'Test content',
              markdown: true,
            }),
            expect.objectContaining({
              facts: [
                { name: 'Status', value: 'Active' },
                { name: 'Priority', value: 'High' },
              ],
            }),
          ]),
          potentialAction: [
            {
              '@type': 'OpenUri',
              name: 'View Details',
              targets: [
                {
                  os: 'default',
                  uri: 'https://example.com/details',
                },
              ],
            },
          ],
        })
      );
    });

    it('should handle errors gracefully', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      const result = await provider.send('test-channel', 'Test Subject', 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.status).toBe('failed');
    });

    it('should fail when webhook URL is not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'TEAMS_WEBHOOK_URL') return '';
        return mockConfig[key] || defaultValue;
      });

      // Re-instantiate provider with new config to get empty webhook URL
      provider = new TeamsProvider(configService as any, httpService as any);

      const result = await provider.send('test-channel', 'Test Subject', 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Teams webhook URL not configured');
    });

    it('should handle unexpected API responses', async () => {
      const mockResponse: AxiosResponse = {
        data: 'unexpected response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await provider.send('test-channel', 'Test Subject', 'Test content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Teams API returned unexpected response');
    });
  });

  describe('sendBulk', () => {
    it('should send multiple messages', async () => {
      const mockResponse: AxiosResponse = {
        data: 1,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const recipients = [
        { to: 'channel1', subject: 'Subject 1', content: 'Content 1' },
        { to: 'channel2', subject: 'Subject 2', content: 'Content 2' },
      ];

      const results = await provider.sendBulk(recipients);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus', () => {
    it('should return unknown status', async () => {
      const status = await provider.getStatus('teams-123456');

      expect(status).toBe('unknown');
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration successfully', async () => {
      const mockResponse: AxiosResponse = {
        data: 1,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        mockConfig.TEAMS_WEBHOOK_URL,
        expect.objectContaining({
          '@type': 'MessageCard',
          summary: 'Configuration Test',
        })
      );
    });

    it('should fail validation when webhook URL is missing', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'TEAMS_WEBHOOK_URL') return '';
        return mockConfig[key] || defaultValue;
      });

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(false);
    });

    it('should fail validation on network error', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      const isValid = await provider.validateConfig();

      expect(isValid).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when webhook URL is configured', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('should return false when webhook URL is not configured', () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'TEAMS_WEBHOOK_URL') return '';
        return mockConfig[key] || defaultValue;
      });

      const newProvider = new TeamsProvider(configService, httpService);
      expect(newProvider.isConfigured()).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      expect(provider.getName()).toBe('teams');
    });
  });
});
