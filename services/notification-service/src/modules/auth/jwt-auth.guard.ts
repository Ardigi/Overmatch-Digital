import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // For notification service, we trust Kong headers
    const request = context.switchToHttp().getRequest();
    
    // Check for Kong consumer headers
    const consumerId = request.headers['x-consumer-id'];
    const consumerCustomId = request.headers['x-consumer-custom-id'];
    
    if (consumerId) {
      // Create a user object from Kong headers
      request.user = {
        id: consumerId,
        organizationId: consumerCustomId,
        // Additional user data can be fetched if needed
      };
      return true;
    }
    
    // Fall back to standard JWT validation
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}