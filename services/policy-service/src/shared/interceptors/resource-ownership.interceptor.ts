import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResourceOwnershipInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // For POST/PATCH requests, automatically set ownership fields
    if (request.method === 'POST' || request.method === 'PATCH') {
      if (request.body && user) {
        // Set organizationId if not provided
        if (!request.body.organizationId && user.organizationId) {
          request.body.organizationId = user.organizationId;
        }

        // Set ownerId for new resources
        if (request.method === 'POST' && !request.body.ownerId) {
          request.body.ownerId = user.id;
          request.body.ownerName = user.name || user.email;
          request.body.ownerEmail = user.email;
        }

        // Set organizationId if not provided
        if (!request.body.organizationId) {
          request.body.organizationId = user.organizationId;
        }

        // Set createdBy/updatedBy
        if (request.method === 'POST') {
          request.body.createdBy = user.id;
          // Don't set updatedBy for POST - it's not in CreatePolicyDto
        } else if (request.method === 'PATCH') {
          request.body.updatedBy = user.id;
        }
      }
    }

    return next.handle().pipe(
      map((data) => {
        // Filter response data based on organization access
        if (data && user && !this.isAdmin(user)) {
          if (Array.isArray(data)) {
            // Filter array results by organization
            return data.filter(
              (item) => !item.organizationId || item.organizationId === user.organizationId
            );
          } else if (data.data && Array.isArray(data.data)) {
            // Handle paginated results
            data.data = data.data.filter(
              (item) => !item.organizationId || item.organizationId === user.organizationId
            );
            return data;
          }
        }
        return data;
      })
    );
  }

  private isAdmin(user: any): boolean {
    const roles = user.roles || [];
    return roles.some((role) =>
      typeof role === 'string' ? role === 'admin' : role.name === 'admin'
    );
  }
}
