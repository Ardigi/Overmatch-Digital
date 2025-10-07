#!/usr/bin/env node

/**
 * Script to fix the admin password in the database
 * This directly updates the password with a properly hashed value
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function fixAdminPassword() {
  console.log('🔧 Fixing admin password...');
  
  // Database connection
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'soc_auth',
    user: 'soc_user',
    password: 'soc_pass'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Generate proper bcrypt hash for Admin@123!
    const password = 'Admin@123!';
    const hash = await bcrypt.hash(password, 12);
    console.log('🔐 Generated hash:', hash);
    console.log('📏 Hash length:', hash.length);

    // Update the admin user's password
    const updateQuery = 'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email';
    const result = await client.query(updateQuery, [hash, 'admin@soc-compliance.com']);

    if (result.rowCount === 0) {
      console.log('❌ No user found with email admin@soc-compliance.com');
      
      // Try to create the user if it doesn't exist
      console.log('📝 Creating admin user...');
      
      // First check if organization exists
      const orgCheck = await client.query('SELECT id FROM organizations LIMIT 1');
      let orgId;
      
      if (orgCheck.rows.length === 0) {
        // Create organization
        const orgResult = await client.query(
          `INSERT INTO organizations (name, status, type) 
           VALUES ($1, $2, $3) 
           RETURNING id`,
          ['Admin Organization', 'active', 'enterprise']
        );
        orgId = orgResult.rows[0].id;
        console.log('✅ Created organization:', orgId);
      } else {
        orgId = orgCheck.rows[0].id;
        console.log('📌 Using existing organization:', orgId);
      }
      
      // Create admin user
      const createResult = await client.query(
        `INSERT INTO users (
          email, password, "firstName", "lastName", 
          status, "emailVerified", roles, "organizationId"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id, email`,
        [
          'admin@soc-compliance.com',
          hash,
          'Admin',
          'User',
          'active',
          true,
          ['super_admin', 'admin'],
          orgId
        ]
      );
      
      console.log('✅ Created admin user:', createResult.rows[0]);
    } else {
      console.log('✅ Updated password for:', result.rows[0]);
    }

    // Verify the password is stored correctly
    const verifyResult = await client.query(
      'SELECT password, length(password) as len FROM users WHERE email = $1',
      ['admin@soc-compliance.com']
    );
    
    const storedHash = verifyResult.rows[0].password;
    const storedLength = verifyResult.rows[0].len;
    
    console.log('📊 Stored hash:', storedHash);
    console.log('📏 Stored length:', storedLength);
    
    // Test the hash
    const testMatch = await bcrypt.compare(password, storedHash);
    console.log('🧪 Password verification:', testMatch ? '✅ SUCCESS' : '❌ FAILED');
    
    if (!testMatch) {
      console.error('⚠️  Warning: Password verification failed. Hash may be corrupted.');
    } else {
      console.log('\n🎉 Admin password fixed successfully!');
      console.log('📧 Email: admin@soc-compliance.com');
      console.log('🔑 Password: Admin@123!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the script
fixAdminPassword().catch(console.error);