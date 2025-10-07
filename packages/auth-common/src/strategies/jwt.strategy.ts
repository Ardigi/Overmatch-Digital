import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId?: string;
  organizationId?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    // Basic validation - services can extend this
    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      organizationId: payload.organizationId,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };
  }
}
