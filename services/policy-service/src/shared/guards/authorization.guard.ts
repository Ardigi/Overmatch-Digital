import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHORIZATION_KEY, type AuthorizationMetadata } from '../decorators/authorize.decorator';
import { AuthorizationService, type UserContext } from '../services/authorization.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authMetadata = this.reflector.getAllAndOverride<AuthorizationMetadata>(
      AUTHORIZATION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!authMetadata) {
      return true; // No authorization required
    }

    const request = context.switchToHttp().getRequest();
    const user: UserContext = this.extractUserContext(request);

    if (!user) {
      return false;
    }

    // Extract resource ID from params if specified
    let resourceId: string | undefined;
    if (authMetadata.useParams) {
      resourceId = request.params[authMetadata.useParams];
    }

    // Check authorization
    const isAuthorized = await this.authorizationService.canPerformAction(
      user,
      authMetadata.action,
      authMetadata.resource,
      resourceId
    );

    // Log the authorization check
    this.authorizationService.logAuthorizationCheck(
      user,
      authMetadata.action,
      authMetadata.resource,
      resourceId,
      isAuthorized
    );

    // Additional ownership check if required
    if (isAuthorized && authMetadata.checkOwnership && resourceId) {
      const isOwner = await this.authorizationService.isResourceOwner(
        user,
        authMetadata.resource,
        resourceId
      );
      return isOwner;
    }

    return isAuthorized;
  }

  private extractUserContext(request: any): UserContext {
    const user = request.user;
    if (!user) return null;

    return {
      id: user.id,
      organizationId: user.organizationId,
      roles: Array.isArray(user.roles)
        ? user.roles.map((r) => (typeof r === 'string' ? r : r.name))
        : [],
      permissions: user.permissions,
    };
  }
}
