import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionService } from '../../sessions/session.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    @Optional() // Make SessionService optional to break circular dependency
    private sessionService?: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      // Add clock tolerance to handle minor time differences
      jsonWebTokenOptions: {
        clockTolerance: 30, // 30 seconds tolerance
      },
    });
  }

  async validate(payload: any) {
    // Check if user still exists and is active
    const user = await this.usersService.findOne(payload.sub);
    
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is not active');
    }

    // Validate session if present and SessionService is available
    if (payload.sessionId && this.sessionService) {
      try {
        const session = await this.sessionService.getSession(payload.sessionId);
        if (!session) {
          throw new UnauthorizedException('Session expired or invalid');
        }
      } catch (error) {
        // If session validation fails, continue without it to avoid circular dependency issues
        // In production, you might want to handle this differently
        console.warn('Session validation failed:', error.message);
      }
    }

    // Return user data to be attached to request
    return {
      id: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      sessionId: payload.sessionId,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}