import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'soc_reporting',
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
