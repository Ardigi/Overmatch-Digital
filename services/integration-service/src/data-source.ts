import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

// Load environment variables
if (process.env.NODE_ENV === 'test') {
  config({ path: '.env.test' });
}
config({ path: '.env.local' });
config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || (process.env.NODE_ENV === 'test' ? '5433' : '5432')),
  username: process.env.DB_USERNAME || (process.env.NODE_ENV === 'test' ? 'test_user' : 'soc_user'),
  password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'test' ? 'test_pass' : 'soc_pass'),
  database:
    process.env.DB_NAME ||
    (process.env.NODE_ENV === 'test' ? 'soc_integrations_test' : 'soc_integrations'),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  subscribers: [],
  extra: {
    max: 20, // Maximum connections
    min: 5, // Minimum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
