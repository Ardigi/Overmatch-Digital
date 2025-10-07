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
    const request = context.switchToHttp().getRequest() as {
      headers: Record<string, string | string[] | undefined>;
      user?: any;
    };

    // Check for Kong headers
    const userId = request.headers['x-user-id'] as string | undefined;
    const userEmail = request.headers['x-user-email'] as string | undefined;
    const organizationId = request.headers['x-organization-id'] as string | undefined;

    if (!userId || !userEmail) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    // Attach user info to request
    request.user = {
      id: userId,
      email: userEmail,
      organizationId: organizationId || null,
      roles:
        typeof request.headers['x-user-roles'] === 'string'
          ? request.headers['x-user-roles'].split(',')
          : [],
    };

    return true;
  }
}
