// CRITICAL: Unmock TypeORM for E2E tests - MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Import reflect-metadata first
import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { testSetup } from './setup-e2e';

describe('Auth E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await testSetup.createTestApp();
  });

  afterAll(async () => {
    await testSetup.closeApp();
  });

  beforeEach(async () => {
    await testSetup.cleanDatabase();
  });

  describe('/auth/register (POST)', () => {
    it('should successfully register a new user', async () => {
      // First create a test user to establish an organization
      const existingUser = await testSetup.seedTestUser({
        email: 'admin@example.com',
        password: 'SecurePass123!@',
      });

      const organizationId = existingUser.organizationId;

      const registerData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!@',
        confirmPassword: 'SecurePass123!@',
        profile: {
          firstName: 'New',
          lastName: 'User',
        },
        organizationId,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(registerData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration with weak password', async () => {
      const registerData = {
        email: 'weak@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        profile: {
          firstName: 'Weak',
          lastName: 'Password',
        },
      };

      await request(app.getHttpServer()).post('/auth/register').send(registerData).expect(400);
    });

    it('should reject registration with mismatched passwords', async () => {
      const registerData = {
        email: 'mismatch@example.com',
        password: 'SecurePass123!@',
        confirmPassword: 'DifferentPass123!@',
        profile: {
          firstName: 'Mismatch',
          lastName: 'User',
        },
      };

      await request(app.getHttpServer()).post('/auth/register').send(registerData).expect(400);
    });

    it('should reject duplicate email registration', async () => {
      // Create an organization and first user
      const user = await testSetup.seedTestUser({
        email: 'existing@example.com',
      });

      const organizationId = user.organizationId;

      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePass123!@',
        confirmPassword: 'SecurePass123!@',
        profile: {
          firstName: 'Duplicate',
          lastName: 'User',
        },
        organizationId,
      };

      await request(app.getHttpServer()).post('/auth/register').send(registerData).expect(409);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should successfully login with valid credentials', async () => {
      const password = 'TestPass123!@';
      await testSetup.seedTestUser({
        email: 'login@example.com',
        password,
        isEmailVerified: true,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('login@example.com');
    });

    it('should reject login with invalid password', async () => {
      await testSetup.seedTestUser({
        email: 'wrong@example.com',
        password: 'CorrectPass123!@',
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'WrongPass123!@',
        })
        .expect(401);
    });

    it('should reject login for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPass123!@',
        })
        .expect(401);
    });

    it('should reject login for unverified email', async () => {
      const password = 'TestPass123!@';
      await testSetup.seedTestUser({
        email: 'unverified@example.com',
        password,
        isEmailVerified: false,
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'unverified@example.com',
          password,
        })
        .expect(403);
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should successfully logout authenticated user', async () => {
      const user = await testSetup.seedTestUser();
      const { accessToken } = await testSetup.login({
        email: user.email,
        password: 'Test123!@',
      });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject logout without authentication', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should successfully refresh tokens', async () => {
      const user = await testSetup.seedTestUser();
      const { refreshToken } = await testSetup.login({
        email: user.email,
        password: 'Test123!@',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken); // New refresh token
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('/auth/profile (GET)', () => {
    it('should return current user profile', async () => {
      const user = await testSetup.seedTestUser({
        email: 'me@example.com',
      });
      const { accessToken } = await testSetup.login({
        email: user.email,
        password: 'Test123!@',
      });

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('me@example.com');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject without authentication', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });

  describe('/auth/change-password (POST)', () => {
    it('should successfully change password', async () => {
      const oldPassword = 'OldPass123!@';
      const newPassword = 'NewPass123!@';

      const user = await testSetup.seedTestUser({
        password: oldPassword,
      });
      const { accessToken } = await testSetup.login({
        email: user.email,
        password: oldPassword,
      });

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: oldPassword,
          newPassword,
          confirmNewPassword: newPassword,
        })
        .expect(200);

      // Verify can login with new password
      await testSetup.login({
        email: user.email,
        password: newPassword,
      });
    });

    it('should reject with incorrect current password', async () => {
      const user = await testSetup.seedTestUser();
      const { accessToken } = await testSetup.login({
        email: user.email,
        password: 'Test123!@',
      });

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPass123!@',
          newPassword: 'NewPass123!@',
          confirmNewPassword: 'NewPass123!@',
        })
        .expect(401);
    });
  });

  describe('/auth/forgot-password (POST)', () => {
    it('should send password reset email', async () => {
      const user = await testSetup.seedTestUser({
        email: 'forgot@example.com',
      });

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'forgot@example.com' })
        .expect(200);
    });

    it('should not reveal if email exists', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Should return same response regardless of email existence
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      // Skip this test when rate limiting is disabled
      if (process.env.DISABLE_RATE_LIMIT === 'true') {
        console.log('Skipping rate limit test - rate limiting is disabled');
        return;
      }

      const user = await testSetup.seedTestUser();

      // Make multiple failed login attempts
      const attempts = 6; // AUTH preset allows 5 per minute
      for (let i = 0; i < attempts; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: user.email,
            password: 'WrongPassword',
          })
          .expect((res) => {
            // First 5 should be 401, 6th should be 429
            if (i < 5) {
              expect(res.status).toBe(401);
            } else {
              expect(res.status).toBe(429);
            }
          });
      }
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key', async () => {
      const user = await testSetup.seedTestUser();
      const apiKey = await testSetup.seedApiKey(user.id);

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('X-API-Key', apiKey.plainKey)
        .expect(200);

      expect(response.body.id).toBe(user.id);
    });

    it('should reject invalid API key', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('X-API-Key', 'invalid-api-key')
        .expect(401);
    });
  });

  describe('MFA Flow', () => {
    it('should require MFA code when enabled', async () => {
      const password = 'Test123!@';
      const user = await testSetup.seedTestUser({
        email: 'mfa@example.com',
        password,
        mfaEnabled: true,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'mfa@example.com',
          password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('requiresMfa', true);
      expect(response.body).toHaveProperty('mfaSessionToken');
      expect(response.body).not.toHaveProperty('accessToken');
    });
  });
});
