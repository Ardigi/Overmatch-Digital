import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class KongAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if this is an HTTP context
    if (context.getType() !== 'http') {
      return false;
    }

    // Check if handler and class methods exist (for test compatibility)
    const handler = context.getHandler();
    const classRef = context.getClass();

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

    // Safely get the request object
    let request;
    try {
      request = context.switchToHttp().getRequest();
    } catch (error) {
      // If we can't get the request, deny access
      return false;
    }

    if (!request) {
      return false;
    }

    // Kong should have added these headers after JWT validation
    // In E2E tests, these are set by the test setup
    const userId = request.headers['x-user-id'];
    const email = request.headers['x-user-email'];
    const organizationId = request.headers['x-organization-id'];

    // Check if basic required headers are present
    if (!userId) {
      return false;
    }

    // Validate user ID format (should be non-empty and follow expected pattern)
    if (typeof userId !== 'string' || userId.trim() === '' || userId.length < 4) {
      return false;
    }

    // Check organization ID after user ID validation
    if (!organizationId) {
      return false;
    }

    // Validate email format if provided
    if (email && (typeof email !== 'string' || !this.isValidEmail(email))) {
      return false;
    }

    // Attach user info to request for backward compatibility
    request.user = {
      id: userId,
      organizationId: organizationId,
      email: email,
      roles: request.headers['x-user-roles']?.split(',') || [],
    };

    return true;
  }

  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
