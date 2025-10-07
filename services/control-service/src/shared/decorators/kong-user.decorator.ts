import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface KongUserType {
  id: string;
  email: string;
  organizationId?: string;
  roles: string[];
  ipAddress?: string;
}

export const KongUser = createParamDecorator((data: unknown, ctx: ExecutionContext): KongUserType => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
