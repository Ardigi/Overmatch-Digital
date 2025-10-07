const { DataSource } = require('typeorm');
const { config } = require('dotenv');
const { join } = require('path');

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'soc_auth',
  synchronize: false,
  logging: true,
  entities: [join(__dirname, 'src/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'src/migrations/*{.ts,.js}')],
  subscribers: [],
});

module.exports = AppDataSource;
