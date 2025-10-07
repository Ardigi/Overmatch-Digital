// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { MinimalIntegrationServiceE2ESetup } from './minimal-setup';

describe('Integration Service E2E Tests - Minimal', () => {
  let setup: MinimalIntegrationServiceE2ESetup;

  beforeAll(async () => {
    setup = new MinimalIntegrationServiceE2ESetup();
    await setup.createTestApp();
  }, 30000);

  afterAll(async () => {
    await setup.closeApp();
  });

  describe('Basic Health Checks', () => {
    it('should compile and start the application', async () => {
      const app = setup.getApp();
      expect(app).toBeDefined();
    });

    it('should respond to health endpoint', async () => {
      const response = await setup.makeRequest('get', '/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should respond to providers endpoint', async () => {
      const response = await setup.makeRequest('get', '/providers');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should respond to integrations endpoint', async () => {
      const response = await setup.makeRequest('get', '/integrations');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
