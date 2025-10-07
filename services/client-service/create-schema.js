const { config } = require('dotenv');
const { DataSource } = require('typeorm');
const path = require('path');

// Load environment variables
config({ path: '.env' });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'soc_user',
  password: process.env.DB_PASSWORD || 'soc_pass',
  database: process.env.DB_NAME || 'soc_clients',
  synchronize: true,
  logging: true,
  entities: [path.join(__dirname, 'dist/**/*.entity.js')],
});

async function createSchema() {
  try {
    console.log('Initializing client-service data source...');
    await dataSource.initialize();
    console.log('✅ Client-service database schema created successfully!');

    // List created tables
    const tables = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Created tables:');
    tables.forEach((table) => console.log(`  - ${table.table_name}`));
  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
    console.error('Full error:', error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

createSchema();
