const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5434,
  user: 'soc_user',
  password: 'soc_pass',
  database: 'soc_auth',
});

async function checkAuthStatus() {
  try {
    await client.connect();
    console.log('✅ Connected to database successfully\n');

    // Check all tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_catalog = 'soc_auth'
      ORDER BY table_name;
    `);

    console.log('📋 Tables in soc_auth database:');
    if (tablesRes.rows.length === 0) {
      console.log('❌ No tables found!');
    } else {
      console.log(`✅ Found ${tablesRes.rows.length} tables:`);
      tablesRes.rows.forEach((row) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Check users table
    try {
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`\n👥 Total users: ${userCount.rows[0].count}`);

      // Check for admin users
      const adminCount = await client.query(
        'SELECT COUNT(*) FROM users WHERE "userType" = \'admin\''
      );
      console.log(`👑 Admin users: ${adminCount.rows[0].count}`);

      // List all users
      const users = await client.query(
        'SELECT id, email, "firstName", "lastName", status, "userType" FROM users LIMIT 10'
      );
      if (users.rows.length > 0) {
        console.log('\n📧 Users in database:');
        users.rows.forEach((user) => {
          console.log(
            `  - ${user.email} (${user.firstName} ${user.lastName}) - Status: ${user.status}, Type: ${user.userType}`
          );
        });
      }
    } catch (e) {
      console.error('❌ Error querying users table:', e.message);
    }

    // Check organizations
    try {
      const orgCount = await client.query('SELECT COUNT(*) FROM organizations');
      console.log(`\n🏢 Total organizations: ${orgCount.rows[0].count}`);

      const orgs = await client.query('SELECT id, name, type FROM organizations LIMIT 5');
      if (orgs.rows.length > 0) {
        console.log('\nOrganizations:');
        orgs.rows.forEach((org) => {
          console.log(`  - ${org.name} (Type: ${org.type})`);
        });
      }
    } catch (e) {
      console.error('❌ Error querying organizations table:', e.message);
    }

    await client.end();
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
}

checkAuthStatus();
