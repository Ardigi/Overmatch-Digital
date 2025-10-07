import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
const jwksClient = require('jwks-rsa');
// Type imports are safe - they're removed at runtime
import type UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation';
import type RoleRepresentation from '@keycloak/keycloak-admin-client/lib/defs/roleRepresentation';

interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

interface TokenValidation {
  valid: boolean;
  userId?: string;
  email?: string;
  roles?: string[];
  error?: string;
}

@Injectable()
export class KeycloakService implements OnModuleInit {
  private adminClient: any; // Will be initialized with dynamic import
  private jwksClient: any;
  private readonly logger = new Logger(KeycloakService.name);
  private readonly realm = 'compliance-platform';
  private readonly keycloakUrl: string;

  constructor(private configService: ConfigService) {
    // Use container name when running in Docker network
    const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
    const defaultUrl = isDocker ? 'http://soc-keycloak:8080' : 'http://localhost:8180';
    this.keycloakUrl = this.configService.get('KEYCLOAK_URL', defaultUrl);
  }

  async onModuleInit() {
    try {
      // Dynamic import for ESM module
      const { default: KeycloakAdminClient } = await import('@keycloak/keycloak-admin-client');
      
      // Initialize the admin client (auth happens against master realm)
      this.adminClient = new KeycloakAdminClient({
        baseUrl: this.keycloakUrl,
        realmName: 'master', // Admin auth always happens against master realm
      });
      
      // Initialize JWKS client for JWT validation
      this.jwksClient = jwksClient({
        jwksUri: `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/certs`,
        cache: true,
        cacheMaxAge: 3600000, // 1 hour
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 30000, // 30 seconds
      });
      
      await this.initialize();
      this.logger.log('Successfully connected to Keycloak with JWKS validation');
    } catch (error) {
      this.logger.error('Failed to connect to Keycloak', error);
      // Don't throw - allow service to start even if Keycloak is temporarily unavailable
    }
  }

  async initialize(): Promise<void> {
    try {
      // SECURITY: Use environment variables for credentials - NEVER hardcode
      const adminUsername = this.configService.get('KEYCLOAK_ADMIN');
      const adminPassword = this.configService.get('KEYCLOAK_ADMIN_PASSWORD');
      
      if (!adminUsername || !adminPassword) {
        throw new Error('Keycloak admin credentials not configured. Set KEYCLOAK_ADMIN and KEYCLOAK_ADMIN_PASSWORD environment variables.');
      }
      
      await this.adminClient.auth({
        username: adminUsername,
        password: adminPassword,
        grantType: 'password',
        clientId: 'admin-cli',
      });
      
      // Refresh token periodically
      setInterval(async () => {
        try {
          await this.adminClient.auth({
            username: adminUsername,
            password: adminPassword,
            grantType: 'password',
            clientId: 'admin-cli',
          });
        } catch (error) {
          this.logger.error('Failed to refresh Keycloak token', error);
        }
      }, 58 * 1000); // Refresh every 58 seconds (token expires in 60)
    } catch (error) {
      this.logger.error('Failed to authenticate with Keycloak', error);
      throw error;
    }
  }

  async createUser(userData: CreateUserDto): Promise<string> {
    try {
      const user = await this.adminClient.users.create({
        realm: this.realm,
        username: userData.email,
        email: userData.email,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        enabled: true,
        emailVerified: userData.emailVerified ?? false,
        credentials: [{
          type: 'password',
          value: userData.password,
          temporary: false,
        }],
      });
      
      this.logger.log(`User created in Keycloak: ${userData.email}`);
      return user.id;
    } catch (error) {
      this.logger.error('Failed to create user in Keycloak', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserRepresentation | null> {
    try {
      const user = await this.adminClient.users.findOne({
        realm: this.realm,
        id: userId,
      });
      return user;
    } catch (error) {
      this.logger.error(`Failed to get user ${userId} from Keycloak`, error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<UserRepresentation | null> {
    try {
      const users = await this.adminClient.users.find({
        realm: this.realm,
        email,
        exact: true,
      });
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email} from Keycloak`, error);
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<UserRepresentation>): Promise<void> {
    try {
      await this.adminClient.users.update(
        {
          realm: this.realm,
          id: userId,
        },
        updates
      );
      this.logger.log(`User ${userId} updated in Keycloak`);
    } catch (error) {
      this.logger.error(`Failed to update user ${userId} in Keycloak`, error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.adminClient.users.del({
        realm: this.realm,
        id: userId,
      });
      this.logger.log(`User ${userId} deleted from Keycloak`);
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId} from Keycloak`, error);
      throw error;
    }
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    try {
      const role = await this.adminClient.roles.findOneByName({
        realm: this.realm,
        name: roleName,
      });
      
      if (!role) {
        throw new Error(`Role ${roleName} not found in Keycloak`);
      }

      if (!role.id) {
        throw new Error(`Role ${roleName} has no ID`);
      }
      
      await this.adminClient.users.addRealmRoleMappings({
        realm: this.realm,
        id: userId,
        roles: [{ id: role.id, name: role.name }],
      });
      
      this.logger.log(`Role ${roleName} assigned to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to assign role ${roleName} to user ${userId}`, error);
      throw error;
    }
  }

  async removeRole(userId: string, roleName: string): Promise<void> {
    try {
      const role = await this.adminClient.roles.findOneByName({
        realm: this.realm,
        name: roleName,
      });
      
      if (!role) {
        throw new Error(`Role ${roleName} not found in Keycloak`);
      }

      if (!role.id) {
        throw new Error(`Role ${roleName} has no ID`);
      }
      
      await this.adminClient.users.delRealmRoleMappings({
        realm: this.realm,
        id: userId,
        roles: [{ id: role.id, name: role.name }],
      });
      
      this.logger.log(`Role ${roleName} removed from user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove role ${roleName} from user ${userId}`, error);
      throw error;
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    try {
      const roles = await this.adminClient.users.listRealmRoleMappings({
        realm: this.realm,
        id: userId,
      });
      return roles.map(role => role.name || '').filter(Boolean);
    } catch (error) {
      this.logger.error(`Failed to get roles for user ${userId}`, error);
      return [];
    }
  }

  async validateToken(token: string): Promise<TokenValidation> {
    try {
      // SECURITY: Proper JWT validation with Keycloak's public key
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || typeof decoded === 'string') {
        return {
          valid: false,
          error: 'Invalid token format',
        };
      }

      // Get the key ID from the token header
      const kid = decoded.header.kid;
      if (!kid) {
        return {
          valid: false,
          error: 'Token missing key ID',
        };
      }

      // Get the signing key from Keycloak's JWKS endpoint
      const key = await this.getSigningKey(kid);
      
      // Verify the token with proper validation
      const verified = jwt.verify(token, key, {
        algorithms: ['RS256'],
        issuer: `${this.keycloakUrl}/realms/${this.realm}`,
        audience: 'account', // Default Keycloak audience
      }) as any;

      // Extract user information from verified token
      const userId = verified.sub;
      const email = verified.email;
      const roles = verified.realm_access?.roles || [];

      // Additional security checks
      if (!userId || !email) {
        return {
          valid: false,
          error: 'Token missing required user information',
        };
      }

      // Check token expiration (additional check)
      const now = Math.floor(Date.now() / 1000);
      if (verified.exp && verified.exp < now) {
        return {
          valid: false,
          error: 'Token has expired',
        };
      }

      this.logger.log(`Token validated successfully for user: ${email}`);
      
      return {
        valid: true,
        userId,
        email,
        roles,
      };
    } catch (error) {
      this.logger.error('JWT validation failed', error);
      return {
        valid: false,
        error: error.message || 'Token validation failed',
      };
    }
  }

  private getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err: any, key: any) => {
        if (err) {
          this.logger.error(`Failed to get signing key for kid: ${kid}`, err);
          reject(new Error('Unable to retrieve signing key'));
          return;
        }
        
        const signingKey = key.publicKey || key.rsaPublicKey;
        if (!signingKey) {
          this.logger.error(`No public key found for kid: ${kid}`);
          reject(new Error('No public key found'));
          return;
        }
        
        resolve(signingKey);
      });
    });
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      await this.adminClient.users.resetPassword({
        realm: this.realm,
        id: userId,
        credential: {
          type: 'password',
          value: newPassword,
          temporary: false,
        },
      });
      this.logger.log(`Password reset for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to reset password for user ${userId}`, error);
      throw error;
    }
  }

  async enableUser(userId: string): Promise<void> {
    await this.updateUser(userId, { enabled: true });
  }

  async disableUser(userId: string): Promise<void> {
    await this.updateUser(userId, { enabled: false });
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.updateUser(userId, { emailVerified: true });
  }

  /**
   * Authenticate a user against Keycloak and get tokens
   * Uses Direct Access Grants (Resource Owner Password Credentials) flow
   * This is the proper way to authenticate for enterprise SOC2 compliance
   */
  async authenticateUser(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  } | null> {
    try {
      // Use fetch to make the token request
      const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: 'compliance-platform-realm', // The correct client ID for compliance-platform realm
        username: email,
        password: password,
        scope: 'openid profile email',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Keycloak authentication failed: ${error}`);
        return null;
      }

      const tokenData = await response.json();
      
      this.logger.log(`User authenticated successfully via Keycloak: ${email}`);
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
      };
    } catch (error) {
      this.logger.error('Failed to authenticate user with Keycloak', error);
      return null;
    }
  }

  /**
   * Refresh tokens using Keycloak refresh token
   */
  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  } | null> {
    try {
      const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'compliance-platform-realm',
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Keycloak token refresh failed: ${error}`);
        return null;
      }

      const tokenData = await response.json();
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
      };
    } catch (error) {
      this.logger.error('Failed to refresh tokens with Keycloak', error);
      return null;
    }
  }

  /**
   * Logout user from Keycloak
   */
  async logoutUser(refreshToken: string): Promise<void> {
    try {
      const logoutUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
      
      const params = new URLSearchParams({
        client_id: 'account',
        refresh_token: refreshToken,
      });

      await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      
      this.logger.log('User logged out from Keycloak');
    } catch (error) {
      this.logger.error('Failed to logout user from Keycloak', error);
    }
  }
}