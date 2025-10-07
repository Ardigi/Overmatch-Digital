import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class KongRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if reflector and context methods are available
    if (!this.reflector || !context.getHandler || !context.getClass) {
      return true; // Allow access if metadata cannot be checked
    }

    const handler = context.getHandler ? context.getHandler() : null;
    const classRef = context.getClass ? context.getClass() : null;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      handler,
      classRef,
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoles = request.headers['x-user-roles']?.split(',') || [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
