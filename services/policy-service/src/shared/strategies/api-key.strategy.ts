import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction, AuditResourceType } from '../../modules/audit/entities/audit-log.entity';

/**
 * API Key Authentication Strategy
 *
 * Validates API keys from Authorization header (Bearer token format)
 * or X-API-Key header. Tracks usage and enforces IP restrictions.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly auditService: AuditService
  ) {
    super(
      {
        header: 'Authorization',
        prefix: 'Bearer ',
      },
      true, // passReqToCallback
      async (apiKey: string, done: any, req: any) => {
        return this.validate(apiKey, done, req);
      }
    );
  }

  async validate(apiKey: string, done: any, req: any): Promise<any> {
    try {
      // Check X-API-Key header if Authorization header doesn't have the key
      if (!apiKey && req.headers['x-api-key']) {
        apiKey = req.headers['x-api-key'];
      }

      if (!apiKey) {
        return done(new UnauthorizedException('API key required'), null);
      }

      // Verify the API key
      const apiKeyEntity = await this.apiKeysService.verifyKey(apiKey);

      if (!apiKeyEntity) {
        // Log failed authentication attempt
        await this.auditService.create({
          organizationId: 'unknown',
          action: AuditAction.FAILED_AUTH,
          resourceType: AuditResourceType.API_KEY,
          description: 'Invalid API key attempt',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            keyPrefix: apiKey.substring(0, 8),
          },
          success: false,
          statusCode: 401,
        });

        return done(new UnauthorizedException('Invalid API key'), null);
      }

      // Check if key is valid
      if (!apiKeyEntity.isValid()) {
        const reason = apiKeyEntity.isExpired() ? 'expired' : 'inactive';

        await this.auditService.create({
          organizationId: apiKeyEntity.organizationId,
          action: AuditAction.FAILED_AUTH,
          resourceType: AuditResourceType.API_KEY,
          resourceId: apiKeyEntity.id,
          resourceName: apiKeyEntity.name,
          description: `API key ${reason}`,
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            reason,
          },
          success: false,
          statusCode: 401,
        });

        return done(new UnauthorizedException(`API key is ${reason}`), null);
      }

      // Check IP restrictions
      if (!apiKeyEntity.isIpAllowed(req.ip)) {
        await this.auditService.create({
          organizationId: apiKeyEntity.organizationId,
          action: AuditAction.PERMISSION_DENIED,
          resourceType: AuditResourceType.API_KEY,
          resourceId: apiKeyEntity.id,
          resourceName: apiKeyEntity.name,
          description: 'IP address not allowed',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            allowedIps: apiKeyEntity.allowedIps,
          },
          success: false,
          statusCode: 403,
        });

        return done(new UnauthorizedException('IP address not allowed'), null);
      }

      // Record usage
      await this.apiKeysService.recordUsage(apiKeyEntity, req.ip);

      // Store API key info in request for rate limiting
      req.apiKeyId = apiKeyEntity.id;
      req.apiKeyRateLimit = apiKeyEntity.rateLimit;
      req.apiKeyRateLimitWindow = apiKeyEntity.rateLimitWindow;

      // Create user context from API key
      const user = {
        id: `api-key:${apiKeyEntity.id}`,
        email: `api-key:${apiKeyEntity.name}`,
        organizationId: apiKeyEntity.organizationId,
        roles: this.mapScopesToRoles(apiKeyEntity.scopes),
        isApiKey: true,
        apiKeyId: apiKeyEntity.id,
        apiKeyName: apiKeyEntity.name,
        apiKeyScopes: apiKeyEntity.scopes,
      };

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }

  /**
   * Map API key scopes to user roles
   */
  private mapScopesToRoles(scopes: string[]): string[] {
    const roles: string[] = [];

    // Map scopes to roles
    if (scopes.includes('ADMIN')) {
      roles.push('admin', 'policy_manager', 'compliance_manager');
    }
    if (scopes.includes('WRITE')) {
      roles.push('policy_manager', 'compliance_manager');
    }
    if (scopes.includes('READ')) {
      roles.push('policy_viewer');
    }

    // Add specific scopes as roles
    scopes.forEach((scope) => {
      if (scope.startsWith('role:')) {
        roles.push(scope.substring(5));
      }
    });

    return [...new Set(roles)]; // Remove duplicates
  }
}
