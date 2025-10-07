const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5434,
  user: 'soc_user',
  password: 'soc_pass',
  database: 'soc_auth',
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Check if tables exist
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n📋 Tables in database:');
    if (res.rows.length === 0) {
      console.log('❌ No tables found! TypeORM has not created tables yet.');
    } else {
      console.log(`✅ Found ${res.rows.length} tables:`);
      res.rows.forEach((row) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Check if users table has any data
    try {
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`\n👥 Users in database: ${userCount.rows[0].count}`);
    } catch (e) {
      // Table might not exist yet
    }

    await client.end();
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
}

testConnection();
