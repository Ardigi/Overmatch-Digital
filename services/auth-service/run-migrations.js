const { DataSource } = require('typeorm');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'soc_user',
  password: process.env.DB_PASSWORD || 'soc_pass',
  database: process.env.DB_NAME || 'soc_auth',
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, 'dist/src/**/*.entity.js')],
  migrations: [path.join(__dirname, 'dist/src/migrations/*.js')],
  subscribers: [],
});

async function runMigrations() {
  try {
    console.log('Initializing data source...');
    await dataSource.initialize();

    console.log('Running migrations...');
    await dataSource.runMigrations();

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await dataSource.destroy();
  }
}

runMigrations();
