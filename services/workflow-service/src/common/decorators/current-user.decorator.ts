import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  id: string;
  email: string;
  organizationId: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
