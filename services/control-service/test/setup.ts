import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'soc_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'soc_pass';
process.env.DB_NAME = 'soc_controls_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'soc_redis_pass';
process.env.DISABLE_KAFKA = 'true';
