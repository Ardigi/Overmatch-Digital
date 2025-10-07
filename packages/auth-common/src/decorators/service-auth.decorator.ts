import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { ServiceAuthGuard } from '../guards/service-auth.guard';

export const SERVICE_AUTH_KEY = 'serviceAuth';

/**
 * Decorator to enable service-to-service authentication on an endpoint
 * Accepts either API keys or service JWT tokens
 */
export function ServiceAuth() {
  return applyDecorators(
    SetMetadata(SERVICE_AUTH_KEY, true),
    UseGuards(ServiceAuthGuard),
    ApiHeader({
      name: 'X-Service-Name',
      description: 'Name of the calling service',
      required: true,
    }),
    ApiHeader({
      name: 'X-Service-API-Key',
      description: 'API key for service authentication (option 1)',
      required: false,
    }),
    ApiHeader({
      name: 'X-Service-Token',
      description: 'JWT token for service authentication (option 2)',
      required: false,
    })
  );
}

/**
 * Decorator to allow both user and service authentication
 * Useful for endpoints that can be called by users or services
 */
export function UserOrServiceAuth() {
  return applyDecorators(
    SetMetadata('allowUserAuth', true),
    SetMetadata('allowServiceAuth', true),
    ApiBearerAuth(),
    ApiHeader({
      name: 'X-Service-Name',
      description: 'Name of the calling service (for service auth)',
      required: false,
    }),
    ApiHeader({
      name: 'X-Service-API-Key',
      description: 'API key for service authentication',
      required: false,
    })
  );
}
