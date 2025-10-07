// Mock Firebase Admin SDK
const mockMessaging = {
  send: jest.fn().mockResolvedValue('projects/test/messages/1234567890'),
  sendMulticast: jest.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: [
      {
        success: true,
        messageId: 'projects/test/messages/1234567890',
      },
    ],
  }),
  subscribeToTopic: jest.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    errors: [],
  }),
  unsubscribeFromTopic: jest.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    errors: [],
  }),
};

const mockApp = {
  name: 'test-app',
  options: {},
};

const messaging = jest.fn(() => mockMessaging);

const credential = {
  cert: jest.fn().mockReturnValue({
    projectId: 'test-project',
    clientEmail: 'test@example.com',
    privateKey: 'test-key',
  }),
};

const initializeApp = jest.fn().mockReturnValue(mockApp);

const app = {
  App: jest.fn(),
};

// Export everything needed
export default {
  messaging,
  credential,
  initializeApp,
  app,
};

export { messaging, credential, initializeApp, app };
