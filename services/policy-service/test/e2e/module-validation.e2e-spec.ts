// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { PolicyServiceE2ESetup } from './setup';

describe('Module Validation E2E Tests', () => {
  let setup: PolicyServiceE2ESetup;

  beforeAll(async () => {
    setup = new PolicyServiceE2ESetup();
    await setup.createTestApp();
  });

  afterAll(async () => {
    await setup.closeApp();
  });

  it('should successfully initialize the application', () => {
    expect(setup.getApp()).toBeDefined();
  });
});
