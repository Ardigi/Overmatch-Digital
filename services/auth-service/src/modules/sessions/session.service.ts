import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EventsService } from '../events/events.service';
import { RedisService } from '../redis/redis.service';

export interface SessionData {
  userId: string;
  organizationId?: string;
  email: string;
  roles: string[];
  permissions: string[];
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface DeviceInfo {
  fingerprint: string;
  name?: string;
  type?: string;
  os?: string;
  browser?: string;
  lastSeen: Date;
  trusted: boolean;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private readonly sessionPrefix = 'session:';
  private readonly userSessionsPrefix = 'user:sessions:';
  private readonly devicePrefix = 'device:';
  private readonly sessionTTL: number;
  private readonly maxConcurrentSessions: number;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
    private eventsService: EventsService
  ) {
    this.sessionTTL = this.configService.get('SESSION_TTL', 28800); // 8 hours
    this.maxConcurrentSessions = this.configService.get('MAX_CONCURRENT_SESSIONS', 5);
  }

  async createSession(
    data: Omit<SessionData, 'createdAt' | 'lastActivityAt' | 'expiresAt'>
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTTL * 1000);

    const sessionData: SessionData = {
      ...data,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    };

    // Store session
    await this.redisService.set(`${this.sessionPrefix}${sessionId}`, sessionData, this.sessionTTL);

    // Add to user's session set
    await this.redisService.sadd(`${this.userSessionsPrefix}${data.userId}`, sessionId);

    // Set expiration on user sessions set
    await this.redisService.expire(`${this.userSessionsPrefix}${data.userId}`, this.sessionTTL);

    // Check concurrent sessions limit
    await this.enforceSessionLimit(data.userId);

    // Track device if fingerprint provided
    if (data.deviceFingerprint) {
      await this.updateDeviceInfo(data.userId, data.deviceFingerprint, {
        lastSeen: now,
        userAgent: data.userAgent,
      });
    }

    // Emit event
    await this.eventsService.publishEvent('session.created', {
      sessionId,
      userId: data.userId,
      ipAddress: data.ipAddress,
      deviceFingerprint: data.deviceFingerprint,
    });

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.redisService.get<SessionData>(`${this.sessionPrefix}${sessionId}`);

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  async updateActivity(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.lastActivityAt = new Date();

    // Extend session if activity is recent
    const timeLeft = new Date(session.expiresAt).getTime() - Date.now();
    if (timeLeft < (this.sessionTTL * 1000) / 2) {
      session.expiresAt = new Date(Date.now() + this.sessionTTL * 1000);
    }

    await this.redisService.set(`${this.sessionPrefix}${sessionId}`, session, this.sessionTTL);

    return true;
  }

  async updateSessionData(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    Object.assign(session, updates);

    await this.redisService.set(`${this.sessionPrefix}${sessionId}`, session, this.sessionTTL);

    return true;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    // Remove session
    await this.redisService.del(`${this.sessionPrefix}${sessionId}`);

    // Remove from user's session set
    await this.redisService.srem(`${this.userSessionsPrefix}${session.userId}`, sessionId);

    // Emit event
    await this.eventsService.publishEvent('session.destroyed', {
      sessionId,
      userId: session.userId,
    });
  }

  async destroyAllUserSessions(userId: string): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);

    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }

    return sessionIds.length;
  }

  async destroyUserSessionsExcept(userId: string, exceptSessionId: string): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);
    let count = 0;

    for (const sessionId of sessionIds) {
      if (sessionId !== exceptSessionId) {
        await this.destroySession(sessionId);
        count++;
      }
    }

    return count;
  }

  async getUserSessions(userId: string): Promise<string[]> {
    return this.redisService.smembers(`${this.userSessionsPrefix}${userId}`);
  }

  async getActiveSessions(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.getUserSessions(userId);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
  }

  async countActiveSessions(userId: string): Promise<number> {
    const sessions = await this.getActiveSessions(userId);
    return sessions.length;
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  // Device Management
  async updateDeviceInfo(
    userId: string,
    fingerprint: string,
    info: Partial<DeviceInfo>
  ): Promise<void> {
    const deviceKey = `${this.devicePrefix}${userId}:${fingerprint}`;
    const existing = await this.redisService.get<DeviceInfo>(deviceKey);

    const deviceInfo: DeviceInfo = {
      fingerprint,
      lastSeen: new Date(),
      trusted: false,
      ...existing,
      ...info,
    };

    await this.redisService.set(deviceKey, deviceInfo, 86400 * 30); // 30 days
  }

  async getDeviceInfo(userId: string, fingerprint: string): Promise<DeviceInfo | null> {
    return this.redisService.get<DeviceInfo>(`${this.devicePrefix}${userId}:${fingerprint}`);
  }

  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const pattern = `${this.devicePrefix}${userId}:*`;
    const keys = await this.redisService.keys(pattern);
    const devices: DeviceInfo[] = [];

    for (const key of keys) {
      const device = await this.redisService.get<DeviceInfo>(key);
      if (device) {
        devices.push(device);
      }
    }

    return devices.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }

  async trustDevice(userId: string, fingerprint: string): Promise<boolean> {
    const device = await this.getDeviceInfo(userId, fingerprint);
    if (!device) {
      return false;
    }

    device.trusted = true;
    await this.updateDeviceInfo(userId, fingerprint, device);

    await this.eventsService.publishEvent('device.trusted', {
      userId,
      deviceFingerprint: fingerprint,
    });

    return true;
  }

  async removeDevice(userId: string, fingerprint: string): Promise<void> {
    await this.redisService.del(`${this.devicePrefix}${userId}:${fingerprint}`);

    // Destroy all sessions from this device
    const sessions = await this.getActiveSessions(userId);
    for (const session of sessions) {
      if (session.deviceFingerprint === fingerprint) {
        await this.destroySession(session.metadata?.sessionId);
      }
    }

    await this.eventsService.publishEvent('device.removed', {
      userId,
      deviceFingerprint: fingerprint,
    });
  }

  // Session Security
  async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = await this.getActiveSessions(userId);

    if (sessions.length > this.maxConcurrentSessions) {
      // Sort by last activity and remove oldest sessions
      const sessionsToRemove = sessions
        .sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime())
        .slice(0, sessions.length - this.maxConcurrentSessions);

      for (const session of sessionsToRemove) {
        await this.destroySession(session.metadata?.sessionId);
      }
    }
  }

  async checkSessionAnomaly(
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    isAnomaly: boolean;
    reason?: string;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { isAnomaly: true, reason: 'Session not found' };
    }

    // Check IP address change
    if (session.ipAddress && session.ipAddress !== ipAddress) {
      // Check if this is a known device
      if (session.deviceFingerprint) {
        const device = await this.getDeviceInfo(session.userId, session.deviceFingerprint);
        if (!device?.trusted) {
          return { isAnomaly: true, reason: 'IP address changed on untrusted device' };
        }
      } else {
        return { isAnomaly: true, reason: 'IP address changed' };
      }
    }

    // Check user agent change
    if (session.userAgent && session.userAgent !== userAgent) {
      return { isAnomaly: true, reason: 'User agent changed' };
    }

    return { isAnomaly: false };
  }

  // Utility Methods
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Session Analytics
  async getSessionStats(): Promise<{
    totalActive: number;
    byUser: Record<string, number>;
    averageSessionDuration: number;
  }> {
    const pattern = `${this.sessionPrefix}*`;
    const sessionKeys = await this.redisService.keys(pattern);
    const byUser: Record<string, number> = {};
    let totalDuration = 0;
    let sessionCount = 0;

    for (const key of sessionKeys) {
      const session = await this.redisService.get<SessionData>(key);
      if (session) {
        byUser[session.userId] = (byUser[session.userId] || 0) + 1;
        const duration =
          new Date(session.lastActivityAt).getTime() - new Date(session.createdAt).getTime();
        totalDuration += duration;
        sessionCount++;
      }
    }

    return {
      totalActive: sessionKeys.length,
      byUser,
      averageSessionDuration: sessionCount > 0 ? totalDuration / sessionCount : 0,
    };
  }
}
