import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

@Injectable()
export class KongAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;

    // Kong should set these headers after JWT validation
    // Support both formats: expected headers and Kong's default headers
    const userId = headers['x-user-id'] || headers['x-consumer-id'];
    const userEmail = headers['x-user-email'] || headers['x-consumer-username'];
    const organizationId = headers['x-organization-id'] || headers['x-consumer-custom-id'];

    if (!userId || !userEmail) {
      throw new UnauthorizedException(
        'Missing authentication headers. Ensure request is routed through Kong Gateway.'
      );
    }

    // Attach user info to request for use in controllers
    request.user = {
      id: userId,
      email: userEmail,
      organizationId: organizationId,
      roles: headers['x-user-roles']?.split(',') || [],
    };

    return true;
  }
}
