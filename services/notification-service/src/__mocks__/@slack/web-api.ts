// Mock Slack WebClient
export class WebClient {
  constructor(token?: string) {
    // Mock constructor
  }

  chat = {
    postMessage: jest.fn().mockResolvedValue({
      ok: true,
      ts: '1234567890.123456',
      channel: 'C1234567890',
      message: {
        text: 'Test message',
        ts: '1234567890.123456',
      },
    }),
    postEphemeral: jest.fn().mockResolvedValue({
      ok: true,
      message_ts: '1234567890.123456',
    }),
    update: jest.fn().mockResolvedValue({
      ok: true,
      ts: '1234567890.123456',
    }),
    delete: jest.fn().mockResolvedValue({
      ok: true,
    }),
  };

  conversations = {
    open: jest.fn().mockResolvedValue({
      ok: true,
      channel: {
        id: 'D1234567890',
      },
    }),
    create: jest.fn().mockResolvedValue({
      ok: true,
      channel: {
        id: 'C1234567890',
        name: 'test-channel',
      },
    }),
    invite: jest.fn().mockResolvedValue({
      ok: true,
    }),
  };

  users = {
    lookupByEmail: jest.fn().mockResolvedValue({
      ok: true,
      user: {
        id: 'U1234567890',
        name: 'testuser',
        email: 'test@example.com',
      },
    }),
  };
}
