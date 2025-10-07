/**
 * Integration test for Auth Service login functionality
 * This test verifies the actual login endpoint works correctly
 */

import axios from 'axios';

const AUTH_SERVICE_URL = 'http://localhost:3001';
const API_GATEWAY_URL = 'http://localhost:8000/api/auth';

describe('Auth Service Login Integration Test', () => {
  // Test data
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };

  describe('Direct Auth Service Tests', () => {
    it('should return 404 for non-existent user login', async () => {
      try {
        await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
          email: 'nonexistent@example.com',
          password: 'password123',
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toContain('Invalid credentials');
      }
    });

    it('should successfully login with admin credentials', async () => {
      const response = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
        email: 'admin@overmatch.digital',
        password: 'Welcome123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data.user).toMatchObject({
        email: 'admin@overmatch.digital',
        roles: expect.arrayContaining(['admin']),
      });
    });
  });

  describe('Kong API Gateway Tests', () => {
    it('should successfully login through Kong', async () => {
      const response = await axios.post(`${API_GATEWAY_URL}/auth/login`, {
        email: 'admin@overmatch.digital',
        password: 'Welcome123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
    });

    it('should validate JWT token through Kong', async () => {
      // First login to get token
      const loginResponse = await axios.post(`${API_GATEWAY_URL}/auth/login`, {
        email: 'admin@overmatch.digital',
        password: 'Welcome123!',
      });

      const token = loginResponse.data.accessToken;

      // Use token to access protected endpoint
      const profileResponse = await axios.get(`${API_GATEWAY_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.data.email).toBe('admin@overmatch.digital');
    });
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running Auth Service Integration Tests...');

  // Simple test runner
  const runTests = async () => {
    let passed = 0;
    let failed = 0;

    try {
      // Test 1: Invalid login
      try {
        await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
          email: 'nonexistent@example.com',
          password: 'password123',
        });
        console.log('❌ Test 1 FAILED: Should have thrown 401');
        failed++;
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log('✅ Test 1 PASSED: Invalid login returns 401');
          passed++;
        } else {
          console.log('❌ Test 1 FAILED:', error.message);
          failed++;
        }
      }

      // Test 2: Valid admin login
      try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
          email: 'admin@overmatch.digital',
          password: 'Welcome123!',
        });

        if (response.data.accessToken && response.data.refreshToken) {
          console.log('✅ Test 2 PASSED: Admin login successful');
          passed++;
        } else {
          console.log('❌ Test 2 FAILED: Missing tokens');
          failed++;
        }
      } catch (error: any) {
        console.log('❌ Test 2 FAILED:', error.response?.data?.message || error.message);
        failed++;
      }

      // Test 3: Kong Gateway login
      try {
        const response = await axios.post(`${API_GATEWAY_URL}/auth/login`, {
          email: 'admin@overmatch.digital',
          password: 'Welcome123!',
        });

        if (response.data.accessToken) {
          console.log('✅ Test 3 PASSED: Kong Gateway login successful');
          passed++;
        } else {
          console.log('❌ Test 3 FAILED: Missing token from Kong');
          failed++;
        }
      } catch (error: any) {
        console.log('❌ Test 3 FAILED:', error.response?.data?.message || error.message);
        failed++;
      }
    } catch (error) {
      console.error('Test suite error:', error);
    }

    console.log('\n=== Test Results ===');
    console.log(`Total: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    process.exit(failed > 0 ? 1 : 0);
  };

  runTests();
}
