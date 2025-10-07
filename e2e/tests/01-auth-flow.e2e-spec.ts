import axios from 'axios';
import { waitFor, checkServiceHealth } from '../setup';

describe('E2E: Authentication Flow', () => {
  const AUTH_SERVICE_URL = 'http://localhost:3001';
  const KONG_URL = 'http://localhost:8000';
  
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    // Wait for auth service to be healthy
    await waitFor(() => checkServiceHealth(AUTH_SERVICE_URL));
  });

  describe('User Registration', () => {
    it('should register a new user', async () => {
      const registerData = {
        email: `test-${Date.now()}@soc-platform.com`,
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Organization'
      };

      const response = await axios.post(
        `${AUTH_SERVICE_URL}/api/auth/register`,
        registerData
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('tokens');
      expect(response.data.user.email).toBe(registerData.email);
      
      userId = response.data.user.id;
      organizationId = response.data.user.organizationId;
      accessToken = response.data.tokens.accessToken;
      refreshToken = response.data.tokens.refreshToken;
    });

    it('should not allow duplicate email registration', async () => {
      const registerData = {
        email: 'duplicate@soc-platform.com',
        password: 'SecurePass123!',
        firstName: 'Duplicate',
        lastName: 'User',
        organizationName: 'Duplicate Org'
      };

      // First registration
      await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, registerData);

      // Second registration should fail
      await expect(
        axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, registerData)
      ).rejects.toThrow();
    });
  });

  describe('User Login', () => {
    const loginEmail = `login-${Date.now()}@soc-platform.com`;
    const loginPassword = 'LoginPass123!';

    beforeAll(async () => {
      // Register a user for login tests
      await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, {
        email: loginEmail,
        password: loginPassword,
        firstName: 'Login',
        lastName: 'Test',
        organizationName: 'Login Test Org'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, {
        email: loginEmail,
        password: loginPassword
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('tokens');
      expect(response.data.tokens).toHaveProperty('accessToken');
      expect(response.data.tokens).toHaveProperty('refreshToken');
    });

    it('should fail login with invalid password', async () => {
      await expect(
        axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, {
          email: loginEmail,
          password: 'WrongPassword123!'
        })
      ).rejects.toThrow();
    });

    it('should fail login with non-existent email', async () => {
      await expect(
        axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, {
          email: 'nonexistent@soc-platform.com',
          password: 'SomePassword123!'
        })
      ).rejects.toThrow();
    });
  });

  describe('Token Management', () => {
    it('should refresh access token', async () => {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/refresh`, {
        refreshToken: refreshToken
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      
      // Update tokens
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
    });

    it('should validate access token', async () => {
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('email');
      expect(response.data.id).toBe(userId);
    });

    it('should reject invalid token', async () => {
      await expect(
        axios.get(`${AUTH_SERVICE_URL}/api/auth/me`, {
          headers: {
            Authorization: 'Bearer invalid-token'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('MFA Setup', () => {
    it('should enable MFA for user', async () => {
      // Setup MFA
      const setupResponse = await axios.post(
        `${AUTH_SERVICE_URL}/api/auth/mfa/setup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(setupResponse.status).toBe(200);
      expect(setupResponse.data).toHaveProperty('secret');
      expect(setupResponse.data).toHaveProperty('qrCode');
      expect(setupResponse.data).toHaveProperty('backupCodes');

      // Note: In real test, would need to generate actual TOTP code
      // For now, we'll skip the verification step
    });
  });

  describe('Password Reset', () => {
    it('should request password reset', async () => {
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/api/auth/forgot-password`,
        {
          email: `test-${Date.now()}@soc-platform.com`
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
    });
  });

  describe('Kong API Gateway Integration', () => {
    it('should route auth requests through Kong', async () => {
      // Register through Kong
      const registerData = {
        email: `kong-${Date.now()}@soc-platform.com`,
        password: 'KongPass123!',
        firstName: 'Kong',
        lastName: 'User',
        organizationName: 'Kong Test Org'
      };

      const response = await axios.post(
        `${KONG_URL}/api/v1/auth/register`,
        registerData
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('tokens');
    });

    it('should apply rate limiting through Kong', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          axios.get(`${KONG_URL}/api/v1/auth/health`).catch(err => err)
        );
      }

      const results = await Promise.all(requests);
      const rateLimited = results.some(
        result => result.response?.status === 429
      );

      expect(rateLimited).toBe(true);
    }, 30000); // Extended timeout for rate limit test
  });

  describe('Session Management', () => {
    it('should logout user', async () => {
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/api/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);

      // Token should be invalid after logout
      await expect(
        axios.get(`${AUTH_SERVICE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
      ).rejects.toThrow();
    });
  });

  // Export tokens for use in other tests
  afterAll(() => {
    global.testContext = {
      accessToken,
      refreshToken,
      userId,
      organizationId
    };
  });
});