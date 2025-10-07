import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { SessionService } from '../../sessions/session.service';

export interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class SessionValidationMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService
  ) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    // Skip for public routes
    if (this.isPublicRoute(req.path)) {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT
      const payload = this.jwtService.verify(token);

      // If session ID is present, validate session
      if (payload.sessionId) {
        const session = await this.sessionService.getSession(payload.sessionId);

        if (!session) {
          throw new UnauthorizedException('Session expired or invalid');
        }

        // Check for session anomalies
        const anomalyCheck = await this.sessionService.checkSessionAnomaly(
          payload.sessionId,
          req.ip || req.socket.remoteAddress || 'unknown',
          req.get('user-agent') || 'unknown'
        );

        if (anomalyCheck.isAnomaly) {
          // Log the anomaly
          console.warn('Session anomaly detected:', {
            sessionId: payload.sessionId,
            userId: payload.sub,
            reason: anomalyCheck.reason,
          });

          // Optionally, you could throw an error or require re-authentication
          // throw new UnauthorizedException('Session anomaly detected');
        }

        // Update session activity
        await this.sessionService.updateActivity(payload.sessionId);

        // Add session data to request
        req.user = {
          ...payload,
          session,
        };
      }
    } catch (error) {
      // Silent fail - let guards handle authentication
    }

    next();
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/google',
      '/auth/microsoft',
      '/auth/saml',
      '/auth/oidc',
      '/health',
    ];

    return publicRoutes.some((route) => path.startsWith(route));
  }
}
