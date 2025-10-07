import type { INestApplication } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import request from 'supertest';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user?: any;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  organizationName?: string;
}

export class AuthHelper {
  private app: INestApplication;
  private baseUrl: string;

  constructor(app: INestApplication, baseUrl = '') {
    this.app = app;
    this.baseUrl = baseUrl;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<any> {
    const response = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/register`)
      .send(data)
      .expect(201);

    return response.body;
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/login`)
      .send(credentials)
      .expect(200);

    return response.body;
  }

  /**
   * Login with MFA
   */
  async loginWithMFA(credentials: LoginCredentials, mfaCode: string): Promise<AuthTokens> {
    // First login to get MFA token
    const initialResponse = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/login`)
      .send(credentials);

    if (initialResponse.body.requiresMfa) {
      // Submit MFA code
      const mfaResponse = await request(this.app.getHttpServer())
        .post(`${this.baseUrl}/auth/mfa/verify`)
        .send({
          mfaToken: initialResponse.body.mfaToken,
          code: mfaCode,
        })
        .expect(200);

      return mfaResponse.body;
    }

    return initialResponse.body;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/refresh`)
      .send({ refreshToken })
      .expect(200);

    return response.body;
  }

  /**
   * Logout
   */
  async logout(accessToken: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/logout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  }

  /**
   * Get current user
   */
  async getCurrentUser(accessToken: string): Promise<any> {
    const response = await request(this.app.getHttpServer())
      .get(`${this.baseUrl}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/verify-email`)
      .send({ token })
      .expect(200);
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/forgot-password`)
      .send({ email })
      .expect(200);
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/reset-password`)
      .send({
        token,
        password: newPassword,
        confirmPassword: newPassword,
      })
      .expect(200);
  }

  /**
   * Change password
   */
  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/change-password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword,
        newPassword,
        confirmNewPassword: newPassword,
      })
      .expect(200);
  }

  /**
   * Setup MFA
   */
  async setupMFA(accessToken: string): Promise<{ secret: string; qrCode: string }> {
    const response = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/mfa/setup`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Enable MFA
   */
  async enableMFA(accessToken: string, code: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/mfa/enable`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);
  }

  /**
   * Disable MFA
   */
  async disableMFA(accessToken: string, code: string): Promise<void> {
    await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/mfa/disable`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);
  }

  /**
   * Generate MFA code for testing
   */
  generateMFACode(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Create API key
   */
  async createApiKey(accessToken: string, name: string): Promise<{ key: string; id: string }> {
    const response = await request(this.app.getHttpServer())
      .post(`${this.baseUrl}/auth/api-keys`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);

    return response.body;
  }

  /**
   * List API keys
   */
  async listApiKeys(accessToken: string): Promise<any[]> {
    const response = await request(this.app.getHttpServer())
      .get(`${this.baseUrl}/auth/api-keys`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(accessToken: string, keyId: string): Promise<void> {
    await request(this.app.getHttpServer())
      .delete(`${this.baseUrl}/auth/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  }

  /**
   * Make authenticated request with API key
   */
  async makeApiKeyRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    apiKey: string,
    body?: any
  ) {
    const req = request(this.app.getHttpServer())[method](url).set('X-API-Key', apiKey);

    if (body) {
      req.send(body);
    }

    return req;
  }

  /**
   * Create a test user and login
   */
  async createAndLoginUser(userData?: Partial<RegisterData>): Promise<{
    user: any;
    tokens: AuthTokens;
  }> {
    const timestamp = Date.now();
    const data: RegisterData = {
      email: `test-${timestamp}@example.com`,
      password: 'TestPassword123!@#',
      confirmPassword: 'TestPassword123!@#',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
      ...userData,
    };

    // Register user
    const user = await this.register(data);

    // In test environment, auto-verify email
    if (process.env.NODE_ENV === 'test') {
      // Direct database update would go here
      // For now, assume email is auto-verified in test mode
    }

    // Login
    const tokens = await this.login({
      email: data.email,
      password: data.password,
    });

    return { user, tokens };
  }

  /**
   * Setup admin user for testing
   */
  async setupAdminUser(): Promise<{
    user: any;
    tokens: AuthTokens;
  }> {
    // Use predefined test admin credentials
    try {
      const tokens = await this.login({
        email: 'admin@test.soc',
        password: 'Admin123!@#',
      });

      const user = await this.getCurrentUser(tokens.accessToken);

      return { user, tokens };
    } catch (error) {
      // If login fails, create new admin
      return this.createAndLoginUser({
        email: `admin-${Date.now()}@test.soc`,
        profile: {
          firstName: 'Admin',
          lastName: 'User',
        },
      });
    }
  }
}
