// Configure test environment
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'workflow-service';

// Add default API keys for test service authentication
process.env.SERVICE_API_KEY_TEST_SERVICE = 'dev-test-service-api-key';
process.env.SERVICE_API_KEY_EVIDENCE_SERVICE = 'dev-evidence-service-api-key-2024';
process.env.SERVICE_API_KEY_CONTROL_SERVICE = 'dev-control-service-api-key-2024';

// Unmock TypeORM to use real database in integration tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Increase timeout for database operations
jest.setTimeout(30000);
