import { ForbiddenException, Injectable,  } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_CHECK_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionService } from '../permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Get permission check function from decorator
    const permissionCheck = this.reflector.getAllAndOverride<Function>(PERMISSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions required, allow access
    if (!requiredPermissions && !permissionCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check static permissions
    if (requiredPermissions) {
      for (const permission of requiredPermissions) {
        const [resource, action] = permission.split(':');
        const hasPermission = await this.permissionService.hasPermission(user.id, {
          resource,
          action,
        });

        if (!hasPermission) {
          throw new ForbiddenException(`Missing required permission: ${permission}`);
        }
      }
    }

    // Check dynamic permissions
    if (permissionCheck) {
      const result = await permissionCheck(request, this.permissionService);
      if (!result) {
        throw new ForbiddenException('Permission check failed');
      }
    }

    return true;
  }
}
