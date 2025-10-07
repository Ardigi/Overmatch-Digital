import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface KongUser {
  id: string;
  organizationId: string;
  email?: string;
  roles?: string[];
}

export const KongUser = createParamDecorator((data: unknown, ctx: ExecutionContext): KongUser => {
  const request = ctx.switchToHttp().getRequest();

  // Kong adds these headers after JWT validation
  const user: KongUser = {
    id: request.headers['x-user-id'] || '',
    organizationId: request.headers['x-organization-id'] || '',
    email: request.headers['x-user-email'],
    roles: request.headers['x-user-roles']?.split(',') || [],
  };

  return user;
});
