// Configure test environment
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'evidence-service';

// Add default API keys for test service authentication
process.env.SERVICE_API_KEY_TEST_SERVICE = 'dev-test-service-api-key';

// Unmock TypeORM to use real database in integration tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Increase timeout for database operations
jest.setTimeout(30000);
