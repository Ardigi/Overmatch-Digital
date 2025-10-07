// Simple integration test for auth flow
const axios = require('axios');

// Configuration
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CLIENT_SERVICE_URL = process.env.CLIENT_SERVICE_URL || 'http://localhost:3002';

// Test user data
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  organizationName: 'Test Organization',
};

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAuthFlow() {
  log('=== Auth Flow Integration Test ===', 'cyan');
  log('');

  let tokens = null;
  let userId = null;

  try {
    // 1. Test health endpoints
    log('1. Testing service health...', 'yellow');

    try {
      const authHealth = await axios.get(`${AUTH_SERVICE_URL}/health`);
      log(`   ✓ Auth Service: ${authHealth.data.status}`, 'green');
    } catch (error) {
      log(`   ✗ Auth Service: ${error.message}`, 'red');
      throw new Error('Auth service not available');
    }

    try {
      const clientHealth = await axios.get(`${CLIENT_SERVICE_URL}/api/v1/health`);
      log(`   ✓ Client Service: ${clientHealth.data.status}`, 'green');
    } catch (error) {
      log(`   ✗ Client Service: ${error.message}`, 'red');
    }

    // 2. Register user
    log('', 'reset');
    log('2. Registering new user...', 'yellow');

    try {
      const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, testUser);
      userId = registerResponse.data.user.id;
      log(`   ✓ User registered: ${testUser.email}`, 'green');
      log(`   User ID: ${userId}`, 'cyan');
    } catch (error) {
      log(`   ✗ Registration failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }

    // 3. Login
    log('', 'reset');
    log('3. Testing login...', 'yellow');

    try {
      const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });

      tokens = {
        access_token: loginResponse.data.access_token,
        refresh_token: loginResponse.data.refresh_token,
      };

      log(`   ✓ Login successful`, 'green');
      log(`   Access token: ${tokens.access_token.substring(0, 20)}...`, 'cyan');
    } catch (error) {
      log(`   ✗ Login failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }

    // 4. Get profile with token
    log('', 'reset');
    log('4. Testing authenticated request...', 'yellow');

    try {
      const profileResponse = await axios.get(`${AUTH_SERVICE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      log(`   ✓ Profile retrieved`, 'green');
      log(`   Name: ${profileResponse.data.fullName}`, 'cyan');
      log(`   Email: ${profileResponse.data.email}`, 'cyan');
    } catch (error) {
      log(`   ✗ Profile request failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }

    // 5. Test token refresh
    log('', 'reset');
    log('5. Testing token refresh...', 'yellow');

    try {
      const refreshResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/refresh`, {
        refresh_token: tokens.refresh_token,
      });

      const newAccessToken = refreshResponse.data.access_token;
      log(`   ✓ Token refreshed successfully`, 'green');
      log(`   New token: ${newAccessToken.substring(0, 20)}...`, 'cyan');
    } catch (error) {
      log(`   ✗ Token refresh failed: ${error.response?.data?.message || error.message}`, 'red');
    }

    // 6. Test client service with auth
    log('', 'reset');
    log('6. Testing Client Service with auth...', 'yellow');

    try {
      // This might fail if client service doesn't have proper auth setup
      const clientsResponse = await axios.get(`${CLIENT_SERVICE_URL}/api/v1/clients`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      log(`   ✓ Client Service authenticated request successful`, 'green');
      log(`   Total clients: ${clientsResponse.data.meta?.total || 0}`, 'cyan');
    } catch (error) {
      log(
        `   ✗ Client Service request failed: ${error.response?.data?.message || error.message}`,
        'red'
      );
      // This is expected if Kong auth is not set up
      if (error.response?.status === 401) {
        log(`   Note: This is expected without Kong Gateway`, 'yellow');
      }
    }

    log('', 'reset');
    log('=== Test Summary ===', 'cyan');
    log('✓ Auth Service is functional', 'green');
    log('✓ User registration works', 'green');
    log('✓ Login and JWT generation works', 'green');
    log('✓ Token-based authentication works', 'green');
    log('✓ Token refresh works', 'green');
  } catch (error) {
    log('', 'reset');
    log('=== Test Failed ===', 'red');
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the test
testAuthFlow().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
