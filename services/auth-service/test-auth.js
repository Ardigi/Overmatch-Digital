const axios = require('axios');

const API_URL = 'http://localhost:3001';

// Test credentials
const testUsers = [
  { email: 'admin@overmatch.digital', password: 'Welcome123!', name: 'Super Admin' },
  { email: 'admin@techcorp.example.com', password: 'Welcome123!', name: 'Client Admin' },
];

// Helper function for colored console output
const log = {
  success: (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`),
  info: (msg) => console.log(`\x1b[36mℹ ${msg}\x1b[0m`),
  header: (msg) => console.log(`\n\x1b[35m=== ${msg} ===\x1b[0m\n`),
};

async function testHealth() {
  log.header('Testing Health Endpoint');
  try {
    const response = await axios.get(`${API_URL}/health`);
    log.success(`Health check passed: ${response.data.status}`);
    return true;
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testSetup() {
  log.header('Testing Setup Endpoint');
  try {
    const response = await axios.post(`${API_URL}/auth/setup`, {
      email: 'test.admin@overmatch.digital',
      password: 'SuperSecure123!@#',
      firstName: 'Test',
      lastName: 'Admin',
      organizationName: 'Test Organization',
      setupKey: 'default-setup-key-change-in-production',
    });
    log.success('Setup endpoint working (but users exist)');
  } catch (error) {
    if (error.response?.data?.message === 'System already initialized') {
      log.info('System already initialized (expected)');
    } else {
      log.error(`Setup failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

async function testLogin(email, password, userName) {
  log.header(`Testing Login for ${userName}`);
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    const { accessToken, refreshToken, user } = response.data;

    if (accessToken && refreshToken) {
      log.success(`Login successful for ${email}`);
      log.info(`User ID: ${user.id}`);
      log.info(`Roles: ${user.roles.join(', ')}`);
      log.info(`Access token: ${accessToken.substring(0, 50)}...`);
      return { accessToken, refreshToken, user };
    }
  } catch (error) {
    log.error(`Login failed: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testRefreshToken(refreshToken) {
  log.header('Testing Refresh Token');
  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });

    const { accessToken } = response.data;
    if (accessToken) {
      log.success('Token refresh successful');
      log.info(`New access token: ${accessToken.substring(0, 50)}...`);
      return accessToken;
    }
  } catch (error) {
    log.error(`Token refresh failed: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testProtectedRoute(accessToken) {
  log.header('Testing Protected Route (Profile)');
  try {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    log.success('Protected route access successful');
    log.info(`User email: ${response.data.email}`);
    return true;
  } catch (error) {
    log.error(`Protected route failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testRegistration() {
  log.header('Testing Registration');
  const timestamp = Date.now();
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: `newuser${timestamp}@example.com`,
      password: 'NewUser123!@#',
      firstName: 'New',
      lastName: 'User',
      organizationId: null, // Will be assigned default org
    });

    log.success('Registration successful');
    log.info(`New user created: ${response.data.user.email}`);
    log.info('Email verification required');
    return true;
  } catch (error) {
    log.error(`Registration failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testPasswordReset() {
  log.header('Testing Password Reset Flow');
  try {
    // Request password reset
    const response = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: 'admin@overmatch.digital',
    });

    log.success('Password reset requested');
    log.info(response.data.message);
    return true;
  } catch (error) {
    log.error(`Password reset failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Auth Service Tests\n');

  // Test health
  const healthOk = await testHealth();
  if (!healthOk) {
    log.error(
      'Auth service not running. Start it with: cd services/auth-service && npm run start:dev'
    );
    return;
  }

  // Test setup
  await testSetup();

  // Test login for each user
  let tokens = null;
  for (const user of testUsers) {
    const result = await testLogin(user.email, user.password, user.name);
    if (result && !tokens) {
      tokens = result; // Save first successful login tokens
    }
  }

  if (tokens) {
    // Test refresh token
    const newAccessToken = await testRefreshToken(tokens.refreshToken);

    // Test protected route
    if (newAccessToken) {
      await testProtectedRoute(newAccessToken);
    }
  }

  // Test registration
  await testRegistration();

  // Test password reset
  await testPasswordReset();

  console.log('\n✅ All tests completed!\n');
}

// Run tests
runAllTests().catch(console.error);
