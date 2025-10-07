import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  PermissionGuard,
  Permissions,
  RolesGuard,
} from '../shared-auth';
import { SessionService } from './session.service';

@Controller('api/v1/sessions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async getMySessions(@Request() req) {
    const sessions = await this.sessionService.getActiveSessions(req.user.id);
    
    // Add current session indicator
    return sessions.map(session => ({
      ...session,
      isCurrent: session.metadata?.jti === req.user.jti,
    }));
  }

  @Get('devices')
  async getMyDevices(@Request() req) {
    return this.sessionService.getUserDevices(req.user.id);
  }

  @Get('stats')
  @Permissions('sessions:admin')
  async getSessionStats() {
    return this.sessionService.getSessionStats();
  }

  @Get('user/:userId')
  @Permissions('sessions:read')
  async getUserSessions(@Param('userId') userId: string) {
    return this.sessionService.getActiveSessions(userId);
  }

  @Post('devices/:fingerprint/trust')
  async trustDevice(@Request() req, @Param('fingerprint') fingerprint: string) {
    const result = await this.sessionService.trustDevice(req.user.id, fingerprint);
    return { success: result };
  }

  @Delete('devices/:fingerprint')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDevice(@Request() req, @Param('fingerprint') fingerprint: string) {
    await this.sessionService.removeDevice(req.user.id, fingerprint);
  }

  @Delete('all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroyAllSessions(@Request() req) {
    // Destroy all sessions except current
    const currentSessionId = req.user.sessionId;
    if (currentSessionId) {
      await this.sessionService.destroyUserSessionsExcept(req.user.id, currentSessionId);
    } else {
      await this.sessionService.destroyAllUserSessions(req.user.id);
    }
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroySession(@Request() req, @Param('sessionId') sessionId: string) {
    // Verify session belongs to user
    const sessions = await this.sessionService.getActiveSessions(req.user.id);
    const session = sessions.find(s => s.metadata?.sessionId === sessionId);
    
    if (session) {
      await this.sessionService.destroySession(sessionId);
    }
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateSession(@Body('sessionId') sessionId: string) {
    const isValid = await this.sessionService.isSessionValid(sessionId);
    return { valid: isValid };
  }
}