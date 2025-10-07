import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface KongUser {
  id: string;
  email: string;
  organizationId: string | null;
  roles: string[];
}

export const KongUser = createParamDecorator((data: unknown, ctx: ExecutionContext): KongUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
