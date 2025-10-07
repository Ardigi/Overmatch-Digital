import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtAuthGuard } from './jwt-auth.guard';
import type { ServiceAuthGuard } from './service-auth.guard';

/**
 * Combined authentication guard that supports both user JWT and service authentication
 * Tries user auth first, then falls back to service auth if configured
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtAuthGuard: JwtAuthGuard,
    private serviceAuthGuard: ServiceAuthGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check if endpoint allows service auth
    const allowServiceAuth = this.reflector.getAllAndOverride<boolean>('allowServiceAuth', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Check if endpoint allows user auth
    const allowUserAuth =
      this.reflector.getAllAndOverride<boolean>('allowUserAuth', [
        context.getHandler(),
        context.getClass(),
      ]) ?? true; // Default to allowing user auth

    // Determine auth method based on headers
    const hasUserAuth = request.headers.authorization?.startsWith('Bearer ');
    const hasServiceAuth =
      request.headers['x-service-api-key'] || request.headers['x-service-token'];

    // Try user authentication first if present and allowed
    if (hasUserAuth && allowUserAuth) {
      try {
        const result = await this.jwtAuthGuard.canActivate(context);
        if (result) {
          request.authMethod = 'user-jwt';
          return true;
        }
      } catch (error) {
        // If user auth fails and service auth is not available, throw
        if (!hasServiceAuth || !allowServiceAuth) {
          throw error;
        }
        // Otherwise, try service auth
      }
    }

    // Try service authentication if allowed
    if (hasServiceAuth && allowServiceAuth) {
      try {
        const result = await this.serviceAuthGuard.canActivate(context);
        if (result) {
          request.authMethod = 'service';
          // Set a user object for compatibility with existing code
          request.user = {
            id: `service:${request.service.name}`,
            organizationId: request.headers['x-organization-id'] || 'system',
            roles: ['service'],
            isService: true,
            serviceName: request.service.name,
          };
          return true;
        }
      } catch (error) {
        throw error;
      }
    }

    // No valid authentication method
    throw new UnauthorizedException('Authentication required (user JWT or service credentials)');
  }
}
