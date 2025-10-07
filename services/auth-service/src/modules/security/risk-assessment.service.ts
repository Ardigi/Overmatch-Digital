import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsService } from '../events/events.service';
import { RedisService } from '../redis/redis.service';

export interface RiskFactors {
  newDevice: boolean;
  newLocation: boolean;
  impossibleTravel: boolean;
  suspiciousTime: boolean;
  tooManyFailedAttempts: boolean;
  knownBadIp: boolean;
  vpnDetected: boolean;
  torDetected: boolean;
  botDetected: boolean;
  deviceAnomalies: boolean;
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  requiresMfa: boolean;
  requiresCaptcha: boolean;
  blocked: boolean;
  reason?: string;
}

export interface LoginContext {
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  timestamp: Date;
}

@Injectable()
export class RiskAssessmentService {
  private readonly failedAttemptsPrefix = 'failed:attempts:';
  private readonly knownDevicesPrefix = 'known:devices:';
  private readonly locationHistoryPrefix = 'location:history:';
  private readonly suspiciousIpsPrefix = 'suspicious:ips:';

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
    private eventsService: EventsService
  ) {}

  async assessLoginRisk(context: LoginContext): Promise<RiskAssessment> {
    const factors: RiskFactors = {
      newDevice: false,
      newLocation: false,
      impossibleTravel: false,
      suspiciousTime: false,
      tooManyFailedAttempts: false,
      knownBadIp: false,
      vpnDetected: false,
      torDetected: false,
      botDetected: false,
      deviceAnomalies: false,
    };

    let score = 0;

    // Check device
    if (context.userId && context.deviceFingerprint) {
      const isKnownDevice = await this.isKnownDevice(context.userId, context.deviceFingerprint);
      if (!isKnownDevice) {
        factors.newDevice = true;
        score += 20;
      }
    }

    // Check failed attempts
    const failedAttempts = await this.getFailedAttempts(context.email, context.ipAddress);
    if (failedAttempts > 3) {
      factors.tooManyFailedAttempts = true;
      score += Math.min(failedAttempts * 10, 40);
    }

    // Check location
    if (context.userId && context.location) {
      const locationRisk = await this.assessLocationRisk(context.userId, context.location);
      if (locationRisk.isNewLocation) {
        factors.newLocation = true;
        score += 15;
      }
      if (locationRisk.impossibleTravel) {
        factors.impossibleTravel = true;
        score += 50;
      }
    }

    // Check time patterns
    const timeRisk = this.assessTimeRisk(context.timestamp);
    if (timeRisk.suspiciousTime) {
      factors.suspiciousTime = true;
      score += 10;
    }

    // Check IP reputation
    const ipRisk = await this.assessIpRisk(context.ipAddress);
    if (ipRisk.knownBadIp) {
      factors.knownBadIp = true;
      score += 30;
    }
    if (ipRisk.vpnDetected) {
      factors.vpnDetected = true;
      score += 15;
    }
    if (ipRisk.torDetected) {
      factors.torDetected = true;
      score += 40;
    }

    // Check for bot patterns
    const botRisk = this.assessBotRisk(context.userAgent);
    if (botRisk.botDetected) {
      factors.botDetected = true;
      score += 25;
    }

    // Check device anomalies
    if (context.deviceFingerprint) {
      const deviceAnomalies = await this.checkDeviceAnomalies(context);
      if (deviceAnomalies) {
        factors.deviceAnomalies = true;
        score += 20;
      }
    }

    // Determine risk level
    let level: RiskAssessment['level'] = 'low';
    let requiresMfa = false;
    let requiresCaptcha = false;
    let blocked = false;

    if (score >= 80) {
      level = 'critical';
      blocked = true;
    } else if (score >= 60) {
      level = 'high';
      requiresMfa = true;
      requiresCaptcha = true;
    } else if (score >= 40) {
      level = 'medium';
      requiresMfa = true;
    } else if (score >= 20) {
      level = 'low';
      requiresCaptcha = true;
    }

    const assessment: RiskAssessment = {
      score,
      level,
      factors,
      requiresMfa,
      requiresCaptcha,
      blocked,
    };

    // Log risk assessment
    await this.logRiskAssessment(context, assessment);

    return assessment;
  }

  async recordFailedAttempt(email: string, ipAddress: string): Promise<void> {
    const emailKey = `${this.failedAttemptsPrefix}email:${email}`;
    const ipKey = `${this.failedAttemptsPrefix}ip:${ipAddress}`;

    await this.redisService.incr(emailKey);
    await this.redisService.expire(emailKey, 3600); // 1 hour

    await this.redisService.incr(ipKey);
    await this.redisService.expire(ipKey, 3600); // 1 hour
  }

  async clearFailedAttempts(email: string, ipAddress: string): Promise<void> {
    await this.redisService.del([
      `${this.failedAttemptsPrefix}email:${email}`,
      `${this.failedAttemptsPrefix}ip:${ipAddress}`,
    ]);
  }

  async recordKnownDevice(userId: string, deviceFingerprint: string): Promise<void> {
    const key = `${this.knownDevicesPrefix}${userId}`;
    await this.redisService.sadd(key, deviceFingerprint);
    await this.redisService.expire(key, 86400 * 90); // 90 days
  }

  async flagSuspiciousIp(ipAddress: string, reason: string): Promise<void> {
    const key = `${this.suspiciousIpsPrefix}${ipAddress}`;
    await this.redisService.set(key, { reason, flaggedAt: new Date() }, 86400 * 7); // 7 days
  }

  private async getFailedAttempts(email: string, ipAddress: string): Promise<number> {
    const emailAttempts =
      (await this.redisService.get<number>(`${this.failedAttemptsPrefix}email:${email}`)) || 0;
    const ipAttempts =
      (await this.redisService.get<number>(`${this.failedAttemptsPrefix}ip:${ipAddress}`)) || 0;
    return Math.max(emailAttempts, ipAttempts);
  }

  private async isKnownDevice(userId: string, deviceFingerprint: string): Promise<boolean> {
    return this.redisService.sismember(`${this.knownDevicesPrefix}${userId}`, deviceFingerprint);
  }

  private async assessLocationRisk(
    userId: string,
    location: LoginContext['location']
  ): Promise<{
    isNewLocation: boolean;
    impossibleTravel: boolean;
  }> {
    const key = `${this.locationHistoryPrefix}${userId}`;
    const history = await this.redisService.lrange(key, 0, 10);

    let isNewLocation = true;
    let impossibleTravel = false;

    for (const entry of history) {
      const historicalLocation = JSON.parse(entry);

      // Check if location is known
      if (
        historicalLocation.country === location?.country &&
        historicalLocation.city === location?.city
      ) {
        isNewLocation = false;
      }

      // Check for impossible travel
      if (
        location?.latitude &&
        location?.longitude &&
        historicalLocation.latitude &&
        historicalLocation.longitude
      ) {
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          historicalLocation.latitude,
          historicalLocation.longitude
        );

        const timeDiff =
          (new Date().getTime() - new Date(historicalLocation.timestamp).getTime()) / 1000 / 3600; // hours
        const maxPossibleDistance = timeDiff * 900; // 900 km/h (max flight speed)

        if (distance > maxPossibleDistance) {
          impossibleTravel = true;
        }
      }
    }

    // Record new location
    await this.redisService.lpush(
      key,
      JSON.stringify({
        ...location,
        timestamp: new Date(),
      })
    );
    await this.redisService.ltrim(key, 0, 50); // Keep last 50 locations
    await this.redisService.expire(key, 86400 * 90); // 90 days

    return { isNewLocation, impossibleTravel };
  }

  private assessTimeRisk(timestamp: Date): { suspiciousTime: boolean } {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();

    // Suspicious if login happens between 2 AM and 5 AM
    const suspiciousTime = hour >= 2 && hour <= 5;

    return { suspiciousTime };
  }

  private async assessIpRisk(ipAddress: string): Promise<{
    knownBadIp: boolean;
    vpnDetected: boolean;
    torDetected: boolean;
  }> {
    // Check if IP is flagged as suspicious
    const suspiciousData = await this.redisService.get(`${this.suspiciousIpsPrefix}${ipAddress}`);
    const knownBadIp = !!suspiciousData;

    // Simple checks for VPN/Tor (in production, use proper IP reputation services)
    const vpnDetected = this.isVpnIp(ipAddress);
    const torDetected = this.isTorIp(ipAddress);

    return { knownBadIp, vpnDetected, torDetected };
  }

  private assessBotRisk(userAgent: string): { botDetected: boolean } {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /go-http/i,
    ];

    const botDetected = botPatterns.some((pattern) => pattern.test(userAgent));

    return { botDetected };
  }

  private async checkDeviceAnomalies(context: LoginContext): Promise<boolean> {
    // Check for rapid device switching
    const recentDevices = await this.redisService.smembers(`recent:devices:${context.email}`);
    if (recentDevices.length > 3) {
      return true;
    }

    // Add current device to recent set
    await this.redisService.sadd(`recent:devices:${context.email}`, context.deviceFingerprint!);
    await this.redisService.expire(`recent:devices:${context.email}`, 3600); // 1 hour

    return false;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private isVpnIp(ipAddress: string): boolean {
    // Simplified check - in production use IP reputation services
    const vpnRanges = [
      '10.', // Private network
      '172.16.', // Private network
      '192.168.', // Private network
    ];

    return vpnRanges.some((range) => ipAddress.startsWith(range));
  }

  private isTorIp(ipAddress: string): boolean {
    // In production, check against Tor exit node list
    return false;
  }

  private async logRiskAssessment(
    context: LoginContext,
    assessment: RiskAssessment
  ): Promise<void> {
    await this.eventsService.publishEvent('security.risk-assessed', {
      email: context.email,
      ipAddress: context.ipAddress,
      deviceFingerprint: context.deviceFingerprint,
      score: assessment.score,
      level: assessment.level,
      factors: assessment.factors,
      timestamp: context.timestamp,
    });
  }
}
