const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres', // Connect to postgres db first
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Terminate existing connections to soc_auth
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'soc_auth'
        AND pid <> pg_backend_pid();
    `);
    console.log('Terminated existing connections');

    // Drop and recreate database
    await client.query('DROP DATABASE IF EXISTS soc_auth');
    console.log('Dropped soc_auth database');

    // Create user if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'soc_user') THEN
          CREATE USER soc_user WITH PASSWORD 'soc_pass';
        END IF;
      END
      $$;
    `);
    console.log('Ensured soc_user exists');

    await client.query('CREATE DATABASE soc_auth OWNER soc_user');
    console.log('Created soc_auth database');

    // Grant privileges
    await client.query('GRANT ALL PRIVILEGES ON DATABASE soc_auth TO soc_user');
    console.log('Granted privileges to soc_user');

    console.log('Database reset complete!');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await client.end();
  }
}

resetDatabase();
