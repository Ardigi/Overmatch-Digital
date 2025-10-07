// Quick test script to verify database connection
const { config } = require('dotenv');
config();

console.log('Testing client-service environment configuration...\n');

// Check environment variables
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USERNAME || 'soc_user',
  password: process.env.DB_PASSWORD || 'soc_pass',
  database: process.env.DB_NAME || 'soc_clients',
};

console.log('Database Configuration:');
console.log('- Host:', dbConfig.host);
console.log('- Port:', dbConfig.port);
console.log('- Username:', dbConfig.username);
console.log('- Database:', dbConfig.database);
console.log('- Password:', dbConfig.password ? '***' : 'NOT SET');

// Test database connection
const { Client } = require('pg');
const client = new Client({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
});

console.log('\nTesting database connection...');
client
  .connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return client.query('SELECT current_database(), current_user');
  })
  .then((result) => {
    console.log('Connected to:', result.rows[0]);
    return client.end();
  })
  .then(() => {
    console.log('\nEnvironment is properly configured!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
