const { config } = require('dotenv');
const { Client } = require('pg');

// Load environment variables
config({ path: '.env' });

async function testConnection() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_auth',
  });

  try {
    console.log('Attempting to connect to database...');
    console.log(`Host: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`Username: ${process.env.DB_USERNAME || 'soc_user'}`);
    console.log(`Database: ${process.env.DB_NAME || 'soc_auth'}`);

    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL!');

    // Test query
    const result = await client.query(
      'SELECT current_database() as db_name, current_user as username'
    );
    console.log('Current database:', result.rows[0].db_name);
    console.log('Current user:', result.rows[0].username);

    // Check for tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(
      'Tables in database:',
      tables.rows.map((r) => r.table_name)
    );
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();
