import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { InitialSeed } from './initial-seed';

// Load environment variables
config({ path: join(__dirname, '../../../.env.local') });
config({ path: join(__dirname, '../../../.env') });

async function runSeed() {
  console.log('Initializing database connection...');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'soc_auth',
    entities: [join(__dirname, '../../modules/**/*.entity{.ts,.js}')],
    synchronize: false, // Don't auto-sync in production
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected successfully');

    // Run seeds
    const initialSeed = new InitialSeed(dataSource);
    await initialSeed.run();

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  runSeed();
}

export { runSeed };
