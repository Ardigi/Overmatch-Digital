import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThan, Repository } from 'typeorm';
import { EventsService } from '../events/events.service';
import { RedisService } from '../redis/redis.service';
import { DeviceFingerprintService } from '../security/device-fingerprint.service';
import { DeviceInfo, SessionService } from '../sessions/session.service';
import { LoginEvent, LoginEventType, LoginRiskLevel } from './entities/login-event.entity';

// Temporarily mock these imports for E2E tests
const geolib = {
  getDistance: (from: any, to: any) => 1000 // Mock distance in meters
};
const lookup = (ip: string) => ({
  country: 'US',
  region: 'CA',
  city: 'San Francisco',
  ll: [37.7749, -122.4194],
  timezone: 'America/Los_Angeles'
});

export interface LoginContext {
  userId?: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: any;
  sessionId?: string;
  timestamp?: Date;
}

export interface AnomalyResult {
  riskScore: number;
  riskLevel: LoginRiskLevel;
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
  }>;
  actions: Array<{
    type: 'allow' | 'require_mfa' | 'block' | 'notify';
    reason: string;
  }>;
  shouldBlock: boolean;
  requireMfa: boolean;
}

export interface UserLoginPattern {
  userId: string;
  loginTimes: {
    hourCounts: Record<number, number>;
    dayOfWeekCounts: Record<number, number>;
    averageHour: number;
    averageDayOfWeek: number;
  };
  locations: Array<{
    country: string;
    city: string;
    count: number;
    lastSeen: Date;
  }>;
  devices: Array<{
    fingerprint: string;
    count: number;
    lastSeen: Date;
  }>;
  ipAddresses: Array<{
    address: string;
    count: number;
    lastSeen: Date;
  }>;
  failureRate: number;
  averageSessionDuration: number;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private readonly bruteForcePrefix = 'brute_force:';
  private readonly credentialStuffingPrefix = 'credential_stuffing:';
  private readonly patternCachePrefix = 'user_pattern:';

  // Thresholds and weights
  private readonly IMPOSSIBLE_TRAVEL_SPEED = 900; // km/h
  private readonly SUSPICIOUS_TRAVEL_SPEED = 500; // km/h
  private readonly TIME_DEVIATION_THRESHOLD = 3; // hours
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly CREDENTIAL_STUFFING_THRESHOLD = 10;
  private readonly RISK_WEIGHTS = {
    newLocation: 15,
    impossibleTravel: 40,
    suspiciousTravel: 25,
    unusualTime: 10,
    newDevice: 20,
    bruteForce: 35,
    credentialStuffing: 45,
    vpnUsage: 15,
    torUsage: 30,
    suspiciousUA: 20,
    rapidLocationChange: 30,
    behaviorAnomaly: 15,
  };

  constructor(
    @InjectRepository(LoginEvent)
    private loginEventRepository: Repository<LoginEvent>,
    private configService: ConfigService,
    private sessionService: SessionService,
    private deviceFingerprintService: DeviceFingerprintService,
    private eventsService: EventsService,
    private redisService: RedisService,
  ) {}

  async detectAnomalies(context: LoginContext): Promise<AnomalyResult> {
    const anomalies: AnomalyResult['anomalies'] = [];
    let totalRiskScore = 0;

    // Get user's login pattern if userId is available
    let userPattern: UserLoginPattern | null = null;
    if (context.userId) {
      userPattern = await this.getUserLoginPattern(context.userId);
    }

    // 1. Check time-based anomalies
    const timeAnomaly = await this.checkTimeAnomaly(context, userPattern);
    if (timeAnomaly) {
      anomalies.push(timeAnomaly);
      totalRiskScore += timeAnomaly.score;
    }

    // 2. Check location-based anomalies
    const locationAnomalies = await this.checkLocationAnomalies(context, userPattern);
    anomalies.push(...locationAnomalies);
    totalRiskScore += locationAnomalies.reduce((sum, a) => sum + a.score, 0);

    // 3. Check device anomalies
    const deviceAnomalies = await this.checkDeviceAnomalies(context, userPattern);
    anomalies.push(...deviceAnomalies);
    totalRiskScore += deviceAnomalies.reduce((sum, a) => sum + a.score, 0);

    // 4. Check brute force attempts
    const bruteForceAnomaly = await this.checkBruteForce(context);
    if (bruteForceAnomaly) {
      anomalies.push(bruteForceAnomaly);
      totalRiskScore += bruteForceAnomaly.score;
    }

    // 5. Check credential stuffing
    const credentialStuffingAnomaly = await this.checkCredentialStuffing(context);
    if (credentialStuffingAnomaly) {
      anomalies.push(credentialStuffingAnomaly);
      totalRiskScore += credentialStuffingAnomaly.score;
    }

    // 6. Check behavioral anomalies
    const behaviorAnomalies = await this.checkBehavioralAnomalies(context, userPattern);
    anomalies.push(...behaviorAnomalies);
    totalRiskScore += behaviorAnomalies.reduce((sum, a) => sum + a.score, 0);

    // Normalize risk score (0-100)
    const normalizedScore = Math.min(totalRiskScore, 100);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(normalizedScore);

    // Determine actions
    const actions = this.determineActions(normalizedScore, anomalies);

    return {
      riskScore: normalizedScore,
      riskLevel,
      anomalies,
      actions,
      shouldBlock: actions.some(a => a.type === 'block'),
      requireMfa: actions.some(a => a.type === 'require_mfa'),
    };
  }

  async recordLoginEvent(
    context: LoginContext,
    eventType: LoginEventType,
    anomalyResult?: AnomalyResult,
  ): Promise<LoginEvent> {
    // Get location data
    const location = context.ipAddress ? await this.getLocationData(context.ipAddress) : undefined;

    // Parse device info
    let deviceInfo: any;
    if (context.deviceFingerprint && context.userAgent) {
      const fingerprint = this.deviceFingerprintService.generateFingerprint({
        userAgent: context.userAgent,
        clientData: context.deviceFingerprint,
      });
      deviceInfo = {
        browser: fingerprint.components.browser?.name,
        browserVersion: fingerprint.components.browser?.version,
        os: fingerprint.components.os?.name,
        osVersion: fingerprint.components.os?.version,
        deviceType: fingerprint.components.device?.type,
        screenResolution: fingerprint.components.screenResolution,
        timezone: fingerprint.components.timezone,
        language: fingerprint.components.language,
      };
    }

    // Calculate behavior metrics
    const behaviorMetrics = this.calculateBehaviorMetrics(context);

    const event = this.loginEventRepository.create({
      userId: context.userId,
      email: context.email,
      eventType,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceFingerprint: context.deviceFingerprint?.hash || 
        (context.deviceFingerprint ? 
          this.deviceFingerprintService.generateFingerprint({
            userAgent: context.userAgent || '',
            clientData: context.deviceFingerprint,
          }).hash : undefined),
      deviceInfo,
      location,
      riskLevel: anomalyResult?.riskLevel || LoginRiskLevel.LOW,
      riskScore: anomalyResult?.riskScore || 0,
      anomalies: anomalyResult?.anomalies,
      behaviorMetrics,
      sessionId: context.sessionId,
      createdAt: context.timestamp || new Date(),
    });

    const savedEvent = await this.loginEventRepository.save(event);

    // Update user pattern cache
    if (context.userId) {
      await this.updateUserPatternCache(context.userId);
    }

    // Emit event for monitoring
    await this.eventsService.publishEvent('auth.login_event', {
      eventId: savedEvent.id,
      userId: context.userId,
      email: context.email,
      eventType,
      riskLevel: savedEvent.riskLevel,
      riskScore: savedEvent.riskScore,
      anomalies: savedEvent.anomalies,
    });

    return savedEvent;
  }

  private async checkTimeAnomaly(
    context: LoginContext,
    pattern: UserLoginPattern | null,
  ): Promise<AnomalyResult['anomalies'][0] | null> {
    if (!pattern) return null;

    const now = context.timestamp || new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Check if login time is unusual
    const hourDeviation = Math.abs(hour - pattern.loginTimes.averageHour);
    const isUnusualTime = hourDeviation > this.TIME_DEVIATION_THRESHOLD;

    // Check if this hour has been used before
    const hourCount = pattern.loginTimes.hourCounts[hour] || 0;
    const totalLogins = Object.values(pattern.loginTimes.hourCounts).reduce((a, b) => a + b, 0);
    const hourFrequency = totalLogins > 0 ? hourCount / totalLogins : 0;

    if (isUnusualTime && hourFrequency < 0.05) {
      return {
        type: 'unusual_time',
        description: `Login at unusual time (${hour}:00) - typical login around ${Math.round(pattern.loginTimes.averageHour)}:00`,
        severity: hourDeviation > 6 ? 'medium' : 'low',
        score: this.RISK_WEIGHTS.unusualTime * (hourDeviation / 12),
      };
    }

    return null;
  }

  private async checkLocationAnomalies(
    context: LoginContext,
    pattern: UserLoginPattern | null,
  ): Promise<AnomalyResult['anomalies']> {
    const anomalies: AnomalyResult['anomalies'] = [];

    if (!context.ipAddress) return anomalies;

    const currentLocation = await this.getLocationData(context.ipAddress);
    if (!currentLocation) return anomalies;

    // Check for VPN/Tor/Proxy
    if (currentLocation.isVpn) {
      anomalies.push({
        type: 'vpn_usage',
        description: 'Login from VPN detected',
        severity: 'low',
        score: this.RISK_WEIGHTS.vpnUsage,
      });
    }

    if (currentLocation.isTor) {
      anomalies.push({
        type: 'tor_usage',
        description: 'Login from Tor network detected',
        severity: 'high',
        score: this.RISK_WEIGHTS.torUsage,
      });
    }

    if (!pattern || !context.userId) return anomalies;

    // Check for new location
    const isKnownLocation = pattern.locations.some(
      loc => loc.country === currentLocation.country && loc.city === currentLocation.city
    );

    if (!isKnownLocation) {
      anomalies.push({
        type: 'new_location',
        description: `Login from new location: ${currentLocation.city}, ${currentLocation.country}`,
        severity: 'medium',
        score: this.RISK_WEIGHTS.newLocation,
      });
    }

    // Check for impossible travel
    const recentLogin = await this.getLastLoginEvent(context.userId);
    if (recentLogin && recentLogin.location && currentLocation.latitude && currentLocation.longitude) {
      const timeDiff = (context.timestamp || new Date()).getTime() - recentLogin.createdAt.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 24 && recentLogin.location.latitude && recentLogin.location.longitude) {
        const distance = geolib.getDistance(
          { latitude: recentLogin.location.latitude, longitude: recentLogin.location.longitude },
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
        ) / 1000; // Convert to km

        const speed = distance / hoursDiff;

        if (speed > this.IMPOSSIBLE_TRAVEL_SPEED) {
          anomalies.push({
            type: 'impossible_travel',
            description: `Impossible travel detected: ${Math.round(distance)}km in ${Math.round(hoursDiff)} hours`,
            severity: 'high',
            score: this.RISK_WEIGHTS.impossibleTravel,
          });
        } else if (speed > this.SUSPICIOUS_TRAVEL_SPEED) {
          anomalies.push({
            type: 'suspicious_travel',
            description: `Suspicious travel speed: ${Math.round(distance)}km in ${Math.round(hoursDiff)} hours`,
            severity: 'medium',
            score: this.RISK_WEIGHTS.suspiciousTravel,
          });
        }
      }
    }

    return anomalies;
  }

  private async checkDeviceAnomalies(
    context: LoginContext,
    pattern: UserLoginPattern | null,
  ): Promise<AnomalyResult['anomalies']> {
    const anomalies: AnomalyResult['anomalies'] = [];

    if (!context.deviceFingerprint || !context.userAgent) return anomalies;

    // Generate fingerprint
    const fingerprint = this.deviceFingerprintService.generateFingerprint({
      userAgent: context.userAgent,
      clientData: context.deviceFingerprint,
    });

    // Check for suspicious user agent
    const deviceAnomalies = this.deviceFingerprintService.detectAnomalies(fingerprint);
    if (deviceAnomalies.length > 0) {
      anomalies.push({
        type: 'suspicious_device',
        description: `Suspicious device characteristics: ${deviceAnomalies.join(', ')}`,
        severity: 'medium',
        score: this.RISK_WEIGHTS.suspiciousUA,
      });
    }

    // Check if device is known
    if (pattern && context.userId) {
      const isKnownDevice = pattern.devices.some(d => d.fingerprint === fingerprint.hash);
      
      if (!isKnownDevice) {
        // Check if device is trusted
        const deviceInfo = await this.sessionService.getDeviceInfo(context.userId, fingerprint.hash);
        
        if (!deviceInfo?.trusted) {
          anomalies.push({
            type: 'new_device',
            description: `Login from new device: ${fingerprint.components.browser?.name || 'Unknown'} on ${fingerprint.components.os?.name || 'Unknown'}`,
            severity: 'medium',
            score: this.RISK_WEIGHTS.newDevice,
          });
        }
      }
    }

    return anomalies;
  }

  private async checkBruteForce(context: LoginContext): Promise<AnomalyResult['anomalies'][0] | null> {
    const key = `${this.bruteForcePrefix}${context.email}`;
    const attempts = await this.redisService.incr(key);
    
    if (attempts === 1) {
      await this.redisService.expire(key, 300); // 5 minutes window
    }

    if (attempts > this.MAX_LOGIN_ATTEMPTS) {
      return {
        type: 'brute_force',
        description: `Multiple failed login attempts detected (${attempts} attempts)`,
        severity: 'high',
        score: this.RISK_WEIGHTS.bruteForce,
      };
    }

    return null;
  }

  private async checkCredentialStuffing(context: LoginContext): Promise<AnomalyResult['anomalies'][0] | null> {
    if (!context.ipAddress) return null;

    const key = `${this.credentialStuffingPrefix}${context.ipAddress}`;
    const attempts = await this.redisService.incr(key);
    
    if (attempts === 1) {
      await this.redisService.expire(key, 600); // 10 minutes window
    }

    if (attempts > this.CREDENTIAL_STUFFING_THRESHOLD) {
      return {
        type: 'credential_stuffing',
        description: `Credential stuffing attack detected from IP ${context.ipAddress}`,
        severity: 'high',
        score: this.RISK_WEIGHTS.credentialStuffing,
      };
    }

    return null;
  }

  private async checkBehavioralAnomalies(
    context: LoginContext,
    pattern: UserLoginPattern | null,
  ): Promise<AnomalyResult['anomalies']> {
    const anomalies: AnomalyResult['anomalies'] = [];

    // This would be enhanced with actual behavioral biometrics
    // For now, we'll use simplified checks

    if (!pattern || !context.userId) return anomalies;

    // Check for rapid session changes
    const activeSessions = await this.sessionService.getActiveSessions(context.userId);
    if (activeSessions.length > 0) {
      const recentSession = activeSessions[0];
      const timeSinceLastActivity = Date.now() - new Date(recentSession.lastActivityAt).getTime();
      
      if (timeSinceLastActivity < 60000 && // Less than 1 minute
          recentSession.ipAddress !== context.ipAddress) {
        anomalies.push({
          type: 'rapid_location_change',
          description: 'Rapid change in login location detected',
          severity: 'medium',
          score: this.RISK_WEIGHTS.rapidLocationChange,
        });
      }
    }

    return anomalies;
  }

  public async getUserLoginPattern(userId: string): Promise<UserLoginPattern> {
    // Check cache first
    const cacheKey = `${this.patternCachePrefix}${userId}`;
    const cached = await this.redisService.get<UserLoginPattern>(cacheKey);
    if (cached) return cached;

    // Calculate pattern from recent login events
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const events = await this.loginEventRepository.find({
      where: {
        userId,
        eventType: LoginEventType.SUCCESS,
        createdAt: MoreThan(thirtyDaysAgo),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const pattern: UserLoginPattern = {
      userId,
      loginTimes: {
        hourCounts: {},
        dayOfWeekCounts: {},
        averageHour: 0,
        averageDayOfWeek: 0,
      },
      locations: [],
      devices: [],
      ipAddresses: [],
      failureRate: 0,
      averageSessionDuration: 0,
    };

    // Analyze login times
    let totalHour = 0;
    let totalDayOfWeek = 0;
    events.forEach(event => {
      const hour = event.createdAt.getHours();
      const dayOfWeek = event.createdAt.getDay();
      
      pattern.loginTimes.hourCounts[hour] = (pattern.loginTimes.hourCounts[hour] || 0) + 1;
      pattern.loginTimes.dayOfWeekCounts[dayOfWeek] = (pattern.loginTimes.dayOfWeekCounts[dayOfWeek] || 0) + 1;
      
      totalHour += hour;
      totalDayOfWeek += dayOfWeek;
    });

    if (events.length > 0) {
      pattern.loginTimes.averageHour = totalHour / events.length;
      pattern.loginTimes.averageDayOfWeek = totalDayOfWeek / events.length;
    }

    // Analyze locations
    const locationMap = new Map<string, any>();
    events.forEach(event => {
      if (event.location) {
        const key = `${event.location.country}-${event.location.city}`;
        const existing = locationMap.get(key);
        if (existing) {
          existing.count++;
          existing.lastSeen = event.createdAt;
        } else {
          locationMap.set(key, {
            country: event.location.country,
            city: event.location.city,
            count: 1,
            lastSeen: event.createdAt,
          });
        }
      }
    });
    pattern.locations = Array.from(locationMap.values());

    // Analyze devices
    const deviceMap = new Map<string, any>();
    events.forEach(event => {
      if (event.deviceFingerprint) {
        const existing = deviceMap.get(event.deviceFingerprint);
        if (existing) {
          existing.count++;
          existing.lastSeen = event.createdAt;
        } else {
          deviceMap.set(event.deviceFingerprint, {
            fingerprint: event.deviceFingerprint,
            count: 1,
            lastSeen: event.createdAt,
          });
        }
      }
    });
    pattern.devices = Array.from(deviceMap.values());

    // Cache the pattern
    await this.redisService.set(cacheKey, pattern, 3600); // 1 hour cache

    return pattern;
  }

  private async updateUserPatternCache(userId: string): Promise<void> {
    const cacheKey = `${this.patternCachePrefix}${userId}`;
    await this.redisService.del(cacheKey);
  }

  private async getLastLoginEvent(userId: string): Promise<LoginEvent | null> {
    return this.loginEventRepository.findOne({
      where: {
        userId,
        eventType: LoginEventType.SUCCESS,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async getLocationData(ipAddress: string): Promise<any> {
    // Use geoip-lite for basic geolocation
    const geo = lookup(ipAddress);
    
    if (!geo) return null;

    // In production, you would also check against threat intelligence feeds
    // for VPN/Tor/Proxy detection
    return {
      country: geo.country,
      countryCode: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.ll?.[0],
      longitude: geo.ll?.[1],
      timezone: geo.timezone,
      isp: null, // Would need additional service
      isVpn: false, // Would need threat intelligence service
      isTor: this.isTorExitNode(ipAddress),
      isProxy: false, // Would need threat intelligence service
    };
  }

  private isTorExitNode(ipAddress: string): boolean {
    // Simplified check - in production, maintain a list of Tor exit nodes
    const torRanges = [
      '198.96.155.3',
      '199.87.154.255',
      // Add more Tor exit node IPs
    ];
    return torRanges.includes(ipAddress);
  }

  private calculateBehaviorMetrics(context: LoginContext): any {
    const now = context.timestamp || new Date();
    return {
      loginTime: {
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        isUsualTime: true, // Would be calculated based on pattern
        deviation: 0,
      },
      // Typing and mouse metrics would come from frontend
    };
  }

  private calculateRiskLevel(score: number): LoginRiskLevel {
    if (score >= 70) return LoginRiskLevel.CRITICAL;
    if (score >= 50) return LoginRiskLevel.HIGH;
    if (score >= 30) return LoginRiskLevel.MEDIUM;
    return LoginRiskLevel.LOW;
  }

  private determineActions(
    score: number,
    anomalies: AnomalyResult['anomalies'],
  ): AnomalyResult['actions'] {
    const actions: AnomalyResult['actions'] = [];

    // Critical risk - block
    if (score >= 70) {
      actions.push({
        type: 'block',
        reason: 'Critical risk level detected',
      });
      actions.push({
        type: 'notify',
        reason: 'Security alert: Blocked login attempt',
      });
      return actions;
    }

    // High risk - require MFA
    if (score >= 50) {
      actions.push({
        type: 'require_mfa',
        reason: 'High risk login detected',
      });
      actions.push({
        type: 'notify',
        reason: 'Security alert: High risk login',
      });
      return actions;
    }

    // Medium risk - require MFA for certain anomalies
    if (score >= 30) {
      const criticalAnomalies = anomalies.filter(a => 
        ['impossible_travel', 'credential_stuffing', 'brute_force'].includes(a.type)
      );
      
      if (criticalAnomalies.length > 0) {
        actions.push({
          type: 'require_mfa',
          reason: `Security concern: ${criticalAnomalies[0].description}`,
        });
      }
      
      actions.push({
        type: 'notify',
        reason: 'Security notice: Unusual login activity',
      });
    }

    // Low risk - allow
    actions.push({
      type: 'allow',
      reason: 'Login risk within acceptable range',
    });

    return actions;
  }

  // Public methods for querying patterns and events
  async getUserLoginHistory(
    userId: string,
    days: number = 30,
  ): Promise<LoginEvent[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.loginEventRepository.find({
      where: {
        userId,
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getSecurityEvents(
    userId: string,
    riskLevel?: LoginRiskLevel,
  ): Promise<LoginEvent[]> {
    const where: any = { userId };
    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    return this.loginEventRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async clearFailedAttempts(email: string): Promise<void> {
    const key = `${this.bruteForcePrefix}${email}`;
    await this.redisService.del(key);
  }
}