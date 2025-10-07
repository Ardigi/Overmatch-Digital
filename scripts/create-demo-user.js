const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function createDemoUser() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/auth_service',
  });

  try {
    await client.connect();

    // Hash the password
    const password = 'Demo123!@#';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user
    const query = `
      INSERT INTO users (
        id,
        email,
        password,
        "firstName",
        "lastName",
        status,
        "userType",
        "emailVerified",
        "mfaEnabled",
        "failedLoginAttempts",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        'active',
        'internal',
        true,
        false,
        0,
        NOW(),
        NOW()
      ) ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        "updatedAt" = NOW()
      RETURNING id, email;
    `;

    const values = ['demo@example.com', hashedPassword, 'Demo', 'User'];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      console.log('Demo user created/updated successfully:');
      console.log('Email:', result.rows[0].email);
      console.log('Password:', password);
      console.log('User ID:', result.rows[0].id);
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await client.end();
  }
}

createDemoUser();
