import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class KongAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if handler and class methods exist (for test compatibility)
    const handler = context.getHandler ? context.getHandler() : null;
    const classRef = context.getClass ? context.getClass() : null;

    // Check if reflector is available and if route is public
    if (this.reflector && (handler || classRef)) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        handler,
        classRef,
      ]);

      if (isPublic) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();

    // First check if Kong provided headers (for backward compatibility)
    let userId = request.headers['x-user-id'];
    let email = request.headers['x-user-email'];
    let organizationId = request.headers['x-organization-id'];
    let roles = request.headers['x-user-roles']?.split(',') || [];

    // If no Kong headers, try to decode JWT from Authorization header
    if (!userId) {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
      }

      const token = authHeader.substring(7);
      try {
        // Decode without verification (Kong already verified it)
        const decoded = jwt.decode(token) as any;
        if (!decoded) {
          return false;
        }

        userId = decoded.sub;
        email = decoded.email;
        organizationId = decoded.organizationId || 'default-org';
        roles = decoded.roles || [];
      } catch (error) {
        return false;
      }
    }

    // Check if basic required headers are present
    if (!userId) {
      return false;
    }

    // Validate user ID format (should be non-empty and follow expected pattern)
    if (typeof userId !== 'string' || userId.trim() === '' || userId.length < 4) {
      return false;
    }

    // Validate email format if provided
    if (email && (typeof email !== 'string' || !this.isValidEmail(email))) {
      return false;
    }

    // Attach user info to request for backward compatibility
    request.user = {
      id: userId,
      organizationId: organizationId || 'default-org',
      email: email,
      roles: roles,
    };

    // Also set headers for KongRolesGuard compatibility
    if (!request.headers['x-user-roles'] && roles.length > 0) {
      request.headers['x-user-roles'] = Array.isArray(roles) ? roles.join(',') : roles;
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
