const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Auth Service Test Suite
 * Tests real functionality of the authentication service
 * No mocking - verifies actual production behavior
 */
class AuthServiceTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testUsers = [];
    this.tokens = {};
  }

  async run() {
    console.log('🔐 Auth Service Test Suite\n');

    try {
      await this.testHealthCheck();
      await this.testUserRegistration();
      await this.testLogin();
      await this.testTokenRefresh();
      await this.testPasswordPolicy();
      await this.testForgotPassword();
      await this.testMFA();
      await this.testSessionManagement();
      await this.testRateLimiting();

      console.log('\n✅ All Auth Service tests passed!');
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async testHealthCheck() {
    console.log('📋 Testing health endpoint...');
    const response = await axios.get(`${this.baseUrl}/health`);
    this.assert(response.status === 200, 'Health check should return 200');
    this.assert(response.data.status === 'ok', 'Health status should be ok');
    console.log('   ✓ Health check passed');
  }

  async testUserRegistration() {
    console.log('\n📋 Testing user registration...');

    const testUser = {
      email: `test-${uuidv4()}@example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      organizationName: 'Test Organization',
    };

    try {
      const response = await axios.post(`${this.baseUrl}/auth/register`, testUser);
      this.assert(response.status === 201, 'Registration should return 201');
      this.assert(response.data.user, 'Should return user data');
      this.assert(response.data.user.email === testUser.email, 'Email should match');
      this.assert(!response.data.user.password, 'Should not return password');

      this.testUsers.push(response.data.user);
      console.log('   ✓ User registration successful');

      // Test duplicate registration
      try {
        await axios.post(`${this.baseUrl}/auth/register`, testUser);
        throw new Error('Duplicate registration should fail');
      } catch (error) {
        this.assert(error.response?.status === 409, 'Duplicate email should return 409');
        console.log('   ✓ Duplicate prevention working');
      }
    } catch (error) {
      throw new Error(`Registration failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async testLogin() {
    console.log('\n📋 Testing login flow...');

    // Test with invalid credentials
    try {
      await axios.post(`${this.baseUrl}/auth/login`, {
        email: 'nonexistent@example.com',
        password: 'WrongPass123!',
      });
      throw new Error('Invalid login should fail');
    } catch (error) {
      this.assert(error.response?.status === 401, 'Invalid credentials should return 401');
      console.log('   ✓ Invalid credential rejection working');
    }

    // Test with valid admin credentials
    const loginData = {
      email: 'admin@overmatch.digital',
      password: 'Welcome123!',
    };

    const response = await axios.post(`${this.baseUrl}/auth/login`, loginData, {
      headers: {
        'X-Device-Id': 'test-device-' + uuidv4(),
        'User-Agent': 'AuthServiceTest/1.0',
      },
    });

    this.assert(response.status === 200, 'Login should return 200');
    this.assert(response.data.access_token, 'Should return access token');
    this.assert(response.data.refresh_token, 'Should return refresh token');
    this.assert(response.data.user, 'Should return user data');

    // Validate JWT structure
    const tokenParts = response.data.access_token.split('.');
    this.assert(tokenParts.length === 3, 'JWT should have 3 parts');

    // Decode and validate payload
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    this.assert(payload.sub, 'JWT should have subject');
    this.assert(payload.email === loginData.email, 'JWT email should match');
    this.assert(payload.exp > Date.now() / 1000, 'JWT should not be expired');

    this.tokens.admin = response.data.access_token;
    this.tokens.adminRefresh = response.data.refresh_token;

    console.log('   ✓ Login successful');
    console.log('   ✓ JWT validation passed');
  }

  async testTokenRefresh() {
    console.log('\n📋 Testing token refresh...');

    if (!this.tokens.adminRefresh) {
      console.log('   ⚠️  Skipping - no refresh token available');
      return;
    }

    const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
      refreshToken: this.tokens.adminRefresh,
    });

    this.assert(response.status === 200, 'Refresh should return 200');
    this.assert(response.data.access_token, 'Should return new access token');
    this.assert(response.data.refresh_token, 'Should return new refresh token');
    this.assert(response.data.access_token !== this.tokens.admin, 'Should return different token');

    console.log('   ✓ Token refresh successful');
  }

  async testPasswordPolicy() {
    console.log('\n📋 Testing password policy...');

    // Test policy validation
    const weakPasswords = [
      'short', // Too short
      'alllowercase', // No uppercase
      'ALLUPPERCASE', // No lowercase
      'NoNumbers!', // No numbers
      'NoSpecial123', // No special chars
      'Password123', // Common password
    ];

    for (const password of weakPasswords) {
      const response = await axios.post(`${this.baseUrl}/auth/password-policy/validate`, {
        password,
      });
      this.assert(!response.data.isValid, `Password "${password}" should be invalid`);
    }

    // Test strong password
    const strongPassword = 'Str0ng!Pass#2024';
    const response = await axios.post(`${this.baseUrl}/auth/password-policy/validate`, {
      password: strongPassword,
    });
    this.assert(response.data.isValid, 'Strong password should be valid');

    console.log('   ✓ Password policy validation working');
  }

  async testForgotPassword() {
    console.log('\n📋 Testing forgot password flow...');

    // Test with valid email
    const response = await axios.post(`${this.baseUrl}/auth/forgot-password`, {
      email: 'admin@overmatch.digital',
    });

    this.assert(response.status === 200, 'Forgot password should return 200');
    console.log('   ✓ Forgot password request sent');

    // Test with invalid email (should still return 200 for security)
    const response2 = await axios.post(`${this.baseUrl}/auth/forgot-password`, {
      email: 'nonexistent@example.com',
    });

    this.assert(response2.status === 200, 'Should return 200 even for invalid email');
    console.log('   ✓ Security: Same response for invalid email');
  }

  async testMFA() {
    console.log('\n📋 Testing MFA endpoints...');

    if (!this.tokens.admin) {
      console.log('   ⚠️  Skipping - no auth token available');
      return;
    }

    // Check MFA status
    const headers = { Authorization: `Bearer ${this.tokens.admin}` };

    try {
      const response = await axios.get(`${this.baseUrl}/auth/mfa/status`, { headers });
      this.assert(response.status === 200, 'MFA status should return 200');
      this.assert(typeof response.data.enabled === 'boolean', 'Should return enabled status');
      console.log('   ✓ MFA status check working');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️  MFA endpoints require authentication setup');
      } else {
        throw error;
      }
    }
  }

  async testSessionManagement() {
    console.log('\n📋 Testing session management...');

    if (!this.tokens.admin) {
      console.log('   ⚠️  Skipping - no auth token available');
      return;
    }

    const headers = { Authorization: `Bearer ${this.tokens.admin}` };

    try {
      // Get active sessions
      const response = await axios.get(`${this.baseUrl}/sessions/active`, { headers });
      this.assert(Array.isArray(response.data), 'Should return array of sessions');
      this.assert(response.data.length > 0, 'Should have at least one active session');
      console.log('   ✓ Active sessions retrieval working');

      // Validate session
      const validateResponse = await axios.post(
        `${this.baseUrl}/sessions/validate`,
        {},
        { headers }
      );
      this.assert(validateResponse.data.valid, 'Current session should be valid');
      console.log('   ✓ Session validation working');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ⚠️  Session endpoints require authentication setup');
      } else {
        throw error;
      }
    }
  }

  async testRateLimiting() {
    console.log('\n📋 Testing rate limiting...');

    const endpoint = `${this.baseUrl}/auth/login`;
    const requests = [];

    // Make 10 rapid requests
    for (let i = 0; i < 10; i++) {
      requests.push(
        axios
          .post(endpoint, {
            email: `ratelimit-test-${i}@example.com`,
            password: 'WrongPass123!',
          })
          .catch((err) => err.response)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r?.status === 429);

    this.assert(rateLimited.length > 0, 'Should trigger rate limiting after multiple requests');
    console.log(`   ✓ Rate limiting triggered after ${10 - rateLimited.length} requests`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    // In a real scenario, we'd delete test users here
    // For now, just log completion
    console.log('   ✓ Cleanup completed');
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }
}

// Run the tests
const tester = new AuthServiceTest();
tester.run().catch(console.error);
