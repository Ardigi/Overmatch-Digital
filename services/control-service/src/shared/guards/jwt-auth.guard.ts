import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId?: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

interface AuthError {
  message: string;
  name: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<TUser = any>(
    err: any, 
    user: any, 
    info: any,
    context?: any,
    status?: any
  ): TUser {
    // Log authentication attempts for security monitoring
    if (err) {
      this.logger.warn(`JWT authentication error: ${err.message}`);
    }
    
    if (info) {
      this.logger.warn(`JWT authentication info: ${info.message}`);
    }

    // Handle various authentication failure scenarios
    if (err) {
      throw new UnauthorizedException(`Authentication failed: ${err.message}`);
    }

    if (!user) {
      const message = info?.message || 'Invalid token or no token provided';
      this.logger.warn(`JWT authentication failed: ${message}`);
      throw new UnauthorizedException(message);
    }

    // Validate user object structure
    this.validateUser(user);

    // Log successful authentication for audit trail
    this.logger.debug(`Successfully authenticated user: ${user.email} (${user.id})`);

    return user as TUser;
  }

  private validateUser(user: any): void {
    // Ensure required fields are present
    if (!user.id || !user.email) {
      this.logger.error('JWT payload missing required fields');
      throw new UnauthorizedException('Invalid token payload - missing required fields');
    }

    // Validate user ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      this.logger.error(`Invalid user ID format in JWT: ${user.id}`);
      throw new UnauthorizedException('Invalid token payload - invalid user ID format');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      this.logger.error(`Invalid email format in JWT: ${user.email}`);
      throw new UnauthorizedException('Invalid token payload - invalid email format');
    }

    // Validate roles array if present
    if (user.roles && !Array.isArray(user.roles)) {
      this.logger.error('Invalid roles format in JWT');
      throw new UnauthorizedException('Invalid token payload - invalid roles format');
    }

    // Sanitize roles to prevent injection
    if (user.roles) {
      user.roles = user.roles
        .filter((role: any) => typeof role === 'string')
        .filter((role: string) => /^[a-zA-Z0-9_-]+$/.test(role))
        .slice(0, 10); // Limit roles to prevent abuse
    }

    // Check token expiration
    if (user.exp && Date.now() >= user.exp * 1000) {
      this.logger.warn(`Expired JWT token for user: ${user.email}`);
      throw new UnauthorizedException('Token has expired');
    }

    // Prevent header injection in user data
    const dangerousChars = /[\r\n\t\0]/;
    if (dangerousChars.test(user.id) || dangerousChars.test(user.email)) {
      this.logger.error('Dangerous characters detected in JWT payload');
      throw new UnauthorizedException('Invalid token payload - dangerous characters detected');
    }
  }
}
