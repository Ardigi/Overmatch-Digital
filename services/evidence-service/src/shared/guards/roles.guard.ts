import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest() as {
      user?: { roles?: Array<string | { name: string }> };
    };

    if (!user || !user.roles) {
      return false;
    }

    // Check if user has any of the required roles
    const userRoles = user.roles.map((role: string | { name: string }) =>
      typeof role === 'string' ? role : role.name
    );
    return requiredRoles.some((role: string) => userRoles.includes(role));
  }
}
