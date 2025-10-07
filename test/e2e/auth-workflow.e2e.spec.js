/**
 * Authentication Workflow E2E Tests
 * Tests the complete authentication flow including registration, login, MFA, and session management
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Service URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CLIENT_SERVICE = process.env.CLIENT_SERVICE_URL || 'http://localhost:3002';

// Test configuration
const TEST_TIMEOUT = 30000;

describe('Authentication Workflow E2E Tests', () => {
  let testUser;
  let accessToken;
  let refreshToken;

  beforeEach(() => {
    // Generate unique test user
    testUser = {
      email: `test-${uuidv4()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      organizationName: `Test Org ${Date.now()}`,
    };
  });

  describe('User Registration Flow', () => {
    test(
      'should register a new user successfully',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          message: expect.stringContaining('registered successfully'),
          user: {
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            emailVerified: false,
            status: 'pending',
          },
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should prevent duplicate email registration',
      async () => {
        // First registration
        await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);

        // Attempt duplicate registration
        try {
          await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(409);
          expect(error.response.data.message).toContain('already exists');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should validate password requirements',
      async () => {
        const weakPasswordUser = {
          ...testUser,
          password: 'weak',
        };

        try {
          await axios.post(`${AUTH_SERVICE}/auth/register`, weakPasswordUser);
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('password');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should validate email format',
      async () => {
        const invalidEmailUser = {
          ...testUser,
          email: 'invalid-email',
        };

        try {
          await axios.post(`${AUTH_SERVICE}/auth/register`, invalidEmailUser);
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('email');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Email Verification Flow', () => {
    let verificationToken;

    beforeEach(async () => {
      // Register user
      const registerResponse = await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);

      // In real scenario, token would be sent via email
      // For testing, we'll extract it from the response or mock it
      verificationToken = registerResponse.data.verificationToken || 'mock-verification-token';
    });

    test(
      'should verify email with valid token',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/verify-email`, {
          token: verificationToken,
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          message: 'Email verified successfully',
          user: {
            emailVerified: true,
            status: 'active',
          },
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should reject invalid verification token',
      async () => {
        try {
          await axios.post(`${AUTH_SERVICE}/auth/verify-email`, {
            token: 'invalid-token',
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('Invalid or expired token');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should resend verification email',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/resend-verification`, {
          email: testUser.email,
        });

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('Verification email sent');
      },
      TEST_TIMEOUT
    );
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      // Register and verify user
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      // In real app, would verify email here
    });

    test(
      'should login with valid credentials',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
          tokenType: 'Bearer',
          user: {
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
          },
        });

        accessToken = response.data.accessToken;
        refreshToken = response.data.refreshToken;
      },
      TEST_TIMEOUT
    );

    test(
      'should reject invalid password',
      async () => {
        try {
          await axios.post(`${AUTH_SERVICE}/auth/login`, {
            email: testUser.email,
            password: 'WrongPassword123!',
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
          expect(error.response.data.message).toContain('Invalid credentials');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should reject non-existent user',
      async () => {
        try {
          await axios.post(`${AUTH_SERVICE}/auth/login`, {
            email: 'nonexistent@example.com',
            password: 'Password123!',
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
          expect(error.response.data.message).toContain('Invalid credentials');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should handle account lockout after failed attempts',
      async () => {
        // Make multiple failed login attempts
        for (let i = 0; i < 5; i++) {
          try {
            await axios.post(`${AUTH_SERVICE}/auth/login`, {
              email: testUser.email,
              password: 'WrongPassword123!',
            });
          } catch (error) {
            // Expected to fail
          }
        }

        // Next attempt should be locked
        try {
          await axios.post(`${AUTH_SERVICE}/auth/login`, {
            email: testUser.email,
            password: testUser.password,
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(423);
          expect(error.response.data.message).toContain('locked');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Token Management', () => {
    beforeEach(async () => {
      // Register and login
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
      refreshToken = loginResponse.data.refreshToken;
    });

    test(
      'should access protected endpoint with valid token',
      async () => {
        const response = await axios.get(`${AUTH_SERVICE}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should reject expired token',
      async () => {
        const expiredToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

        try {
          await axios.get(`${AUTH_SERVICE}/auth/profile`, {
            headers: {
              Authorization: `Bearer ${expiredToken}`,
            },
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should refresh access token',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/refresh`, {
          refreshToken,
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
        });

        // Verify new token works
        const profileResponse = await axios.get(`${AUTH_SERVICE}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${response.data.accessToken}`,
          },
        });
        expect(profileResponse.status).toBe(200);
      },
      TEST_TIMEOUT
    );

    test(
      'should invalidate refresh token after use',
      async () => {
        // Use refresh token
        await axios.post(`${AUTH_SERVICE}/auth/refresh`, {
          refreshToken,
        });

        // Try to use same refresh token again
        try {
          await axios.post(`${AUTH_SERVICE}/auth/refresh`, {
            refreshToken,
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
          expect(error.response.data.message).toContain('Invalid refresh token');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Logout Flow', () => {
    beforeEach(async () => {
      // Register and login
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
      refreshToken = loginResponse.data.refreshToken;
    });

    test(
      'should logout successfully',
      async () => {
        const response = await axios.post(
          `${AUTH_SERVICE}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('Logged out successfully');

        // Verify token is invalidated
        try {
          await axios.get(`${AUTH_SERVICE}/auth/profile`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should invalidate refresh token on logout',
      async () => {
        await axios.post(
          `${AUTH_SERVICE}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // Try to use refresh token
        try {
          await axios.post(`${AUTH_SERVICE}/auth/refresh`, {
            refreshToken,
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Password Reset Flow', () => {
    beforeEach(async () => {
      // Register user
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
    });

    test(
      'should initiate password reset',
      async () => {
        const response = await axios.post(`${AUTH_SERVICE}/auth/forgot-password`, {
          email: testUser.email,
        });

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('Password reset email sent');
      },
      TEST_TIMEOUT
    );

    test(
      'should reset password with valid token',
      async () => {
        // Initiate reset
        await axios.post(`${AUTH_SERVICE}/auth/forgot-password`, {
          email: testUser.email,
        });

        // In real scenario, token would be from email
        const resetToken = 'mock-reset-token';
        const newPassword = 'NewSecurePassword123!';

        const response = await axios.post(`${AUTH_SERVICE}/auth/reset-password`, {
          token: resetToken,
          newPassword,
        });

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('Password reset successfully');

        // Verify can login with new password
        const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
          email: testUser.email,
          password: newPassword,
        });
        expect(loginResponse.status).toBe(200);
      },
      TEST_TIMEOUT
    );

    test(
      'should reject weak new password',
      async () => {
        const resetToken = 'mock-reset-token';

        try {
          await axios.post(`${AUTH_SERVICE}/auth/reset-password`, {
            token: resetToken,
            newPassword: 'weak',
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('password');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('MFA Setup and Authentication', () => {
    let mfaSecret;

    beforeEach(async () => {
      // Register and login
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
    });

    test(
      'should setup MFA',
      async () => {
        const response = await axios.post(
          `${AUTH_SERVICE}/auth/mfa/setup`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          secret: expect.any(String),
          qrCode: expect.any(String),
          backupCodes: expect.arrayContaining([expect.any(String)]),
        });

        mfaSecret = response.data.secret;
      },
      TEST_TIMEOUT
    );

    test(
      'should enable MFA with valid token',
      async () => {
        // Setup MFA first
        const setupResponse = await axios.post(
          `${AUTH_SERVICE}/auth/mfa/setup`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // In real scenario, would generate TOTP token
        const totpToken = '123456';

        const response = await axios.post(
          `${AUTH_SERVICE}/auth/mfa/enable`,
          {
            token: totpToken,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('MFA enabled successfully');
      },
      TEST_TIMEOUT
    );

    test(
      'should require MFA token for login when enabled',
      async () => {
        // Setup and enable MFA
        await axios.post(
          `${AUTH_SERVICE}/auth/mfa/setup`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        await axios.post(
          `${AUTH_SERVICE}/auth/mfa/enable`,
          { token: '123456' },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // Logout
        await axios.post(
          `${AUTH_SERVICE}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // Try to login
        const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data).toMatchObject({
          requiresMfa: true,
          mfaToken: expect.any(String),
        });

        // Complete MFA login
        const mfaResponse = await axios.post(`${AUTH_SERVICE}/auth/login/mfa`, {
          mfaToken: loginResponse.data.mfaToken,
          totpCode: '123456',
        });

        expect(mfaResponse.status).toBe(200);
        expect(mfaResponse.data).toMatchObject({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );
  });

  describe('Cross-Service Authentication', () => {
    beforeEach(async () => {
      // Register and login
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
    });

    test(
      'should access client service with auth token',
      async () => {
        const response = await axios.get(`${CLIENT_SERVICE}/api/v1/clients`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
      },
      TEST_TIMEOUT
    );

    test(
      'should reject unauthenticated requests to client service',
      async () => {
        try {
          await axios.get(`${CLIENT_SERVICE}/api/v1/clients`);
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      // Register and login
      await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
      const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
    });

    test(
      'should track active sessions',
      async () => {
        const response = await axios.get(`${AUTH_SERVICE}/auth/sessions`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('sessions');
        expect(response.data.sessions).toHaveLength(1);
        expect(response.data.sessions[0]).toMatchObject({
          userAgent: expect.any(String),
          ipAddress: expect.any(String),
          createdAt: expect.any(String),
          lastActivity: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should revoke specific session',
      async () => {
        // Get sessions
        const sessionsResponse = await axios.get(`${AUTH_SERVICE}/auth/sessions`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const sessionId = sessionsResponse.data.sessions[0].id;

        // Revoke session
        const response = await axios.delete(`${AUTH_SERVICE}/auth/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('Session revoked');
      },
      TEST_TIMEOUT
    );

    test(
      'should revoke all sessions',
      async () => {
        const response = await axios.post(
          `${AUTH_SERVICE}/auth/sessions/revoke-all`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('All sessions revoked');

        // Verify current token is invalidated
        try {
          await axios.get(`${AUTH_SERVICE}/auth/profile`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Rate Limiting', () => {
    test(
      'should rate limit login attempts',
      async () => {
        const requests = [];

        // Make rapid login attempts
        for (let i = 0; i < 10; i++) {
          requests.push(
            axios
              .post(`${AUTH_SERVICE}/auth/login`, {
                email: `ratelimit${i}@example.com`,
                password: 'Password123!',
              })
              .catch((err) => err.response)
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter((r) => r.status === 429);

        expect(rateLimited.length).toBeGreaterThan(0);
        expect(rateLimited[0].data.message).toContain('Too many requests');
      },
      TEST_TIMEOUT
    );

    test(
      'should rate limit API endpoints per user',
      async () => {
        // Register and login
        await axios.post(`${AUTH_SERVICE}/auth/register`, testUser);
        const loginResponse = await axios.post(`${AUTH_SERVICE}/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });
        accessToken = loginResponse.data.accessToken;

        const requests = [];

        // Make rapid API calls
        for (let i = 0; i < 100; i++) {
          requests.push(
            axios
              .get(`${AUTH_SERVICE}/auth/profile`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              })
              .catch((err) => err.response)
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter((r) => r.status === 429);

        expect(rateLimited.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });
});
