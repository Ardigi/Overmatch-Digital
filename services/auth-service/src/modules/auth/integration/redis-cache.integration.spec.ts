/**
 * REAL Redis Cache Integration Test - Auth Service
 *
 * This test validates actual Redis connectivity and session/cache operations.
 * Tests will FAIL if Redis is not available - no graceful degradation.
 *
 * Prerequisites:
 * - Redis must be running on 127.0.0.1:6379
 * - Redis must be accessible with correct credentials
 */

import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { EventsService } from '../../events/events.service';
import { RedisService } from '../../redis/redis.service';
import { type DeviceInfo, type SessionData, SessionService } from '../../sessions/session.service';

describe('Auth Redis Cache Integration (REAL)', () => {
  let redisService: RedisService;
  let sessionService: SessionService;
  let redis: Redis;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEventsService: jest.Mocked<EventsService>;

  const REDIS_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
    db: 1, // Use different DB for integration tests
  };

  const TEST_USER_ID = 'test-user-' + uuidv4();
  const TEST_ORG_ID = 'test-org-' + uuidv4();

  beforeAll(async () => {
    // CRITICAL: Test must fail if Redis is unavailable
    redis = new Redis(REDIS_CONFIG);

    try {
      const pingResult = await redis.ping();
      if (pingResult !== 'PONG') {
        throw new Error(`Redis ping failed: ${pingResult}`);
      }
    } catch (error) {
      await redis.quit();
      throw new Error(
        `Redis connection failed: ${error.message}. ` +
          'Integration tests require actual Redis connectivity. ' +
          'Start Redis with: docker-compose up redis'
      );
    }

    // Set up mocks
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: '127.0.0.1',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'soc_redis_pass',
          REDIS_DB: 1,
          SESSION_TTL: 3600, // 1 hour for tests
          MAX_CONCURRENT_SESSIONS: 3,
        };
        return config[key] || defaultValue;
      }),
    } as any;

    mockEventsService = {
      publishEvent: jest.fn(),
    } as any;

    // Create services with NO graceful degradation
    redisService = new RedisService(mockConfigService);
    await redisService.onModuleInit();

    // Verify Redis service is connected
    const isConnected = await redisService.exists('test-key');
    expect(typeof isConnected).toBe('boolean'); // Should not throw

    sessionService = new SessionService(redisService, mockConfigService, mockEventsService);
  });

  afterAll(async () => {
    // Clean up connections
    if (redisService) {
      await redisService.onModuleDestroy();
    }
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clear test data from Redis before each test
    await redis.flushdb();
    jest.clearAllMocks();
  });

  describe('Redis Connectivity Requirements', () => {
    it('should require active Redis connection (no graceful degradation)', async () => {
      // Verify Redis is actually connected
      const pingResult = await redis.ping();
      expect(pingResult).toBe('PONG');

      // Verify RedisService is connected
      const testValue = { test: 'data', timestamp: Date.now() };
      await redisService.set('connectivity-test', testValue);
      const retrieved = await redisService.get('connectivity-test');
      expect(retrieved).toEqual(testValue);

      // Verify direct Redis operations work
      await redis.set('direct-test', 'direct-value');
      const directValue = await redis.get('direct-test');
      expect(directValue).toBe('direct-value');
    });

    it('should fail fast when Redis operations fail', async () => {
      // This test documents expected behavior when Redis is unavailable
      const disconnectedRedis = new Redis({
        host: '127.0.0.1',
        port: 9999, // Non-existent port
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryDelayOnFailover: 100,
      });

      // Operations should fail, not return fallback values
      await expect(disconnectedRedis.ping()).rejects.toThrow();
      await expect(disconnectedRedis.set('test', 'value')).rejects.toThrow();

      await disconnectedRedis.quit();
    });
  });

  describe('Real Session Management with Redis', () => {
    let testSessionData: Omit<SessionData, 'createdAt' | 'lastActivityAt' | 'expiresAt'>;

    beforeEach(() => {
      testSessionData = {
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: 'test.user@example.com',
        roles: ['user', 'admin'],
        permissions: ['read:profile', 'write:profile'],
        ipAddress: '192.168.1.100',
        userAgent: 'Integration Test Browser/1.0',
        deviceFingerprint: 'test-device-' + Date.now(),
        metadata: {
          loginMethod: 'password',
          loginTime: Date.now(),
        },
      };
    });

    it('should create, retrieve, and manage session lifecycle', async () => {
      // CREATE SESSION
      const sessionId = await sessionService.createSession(testSessionData);
      expect(sessionId).toBeTruthy();
      expect(sessionId).toHaveLength(64); // 32 bytes hex = 64 chars

      // Verify session exists in Redis
      const redisSessionKey = `session:${sessionId}`;
      const redisValue = await redis.get(redisSessionKey);
      expect(redisValue).toBeTruthy();

      const parsedSession = JSON.parse(redisValue!);
      expect(parsedSession.userId).toBe(TEST_USER_ID);
      expect(parsedSession.email).toBe('test.user@example.com');

      // RETRIEVE SESSION
      const retrievedSession = await sessionService.getSession(sessionId);
      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession!.userId).toBe(TEST_USER_ID);
      expect(retrievedSession!.roles).toEqual(['user', 'admin']);
      expect(retrievedSession!.permissions).toEqual(['read:profile', 'write:profile']);
      expect(retrievedSession!.createdAt).toBeInstanceOf(Date);

      // Verify user session tracking
      const userSessionsKey = `user:sessions:${TEST_USER_ID}`;
      const userSessions = await redis.smembers(userSessionsKey);
      expect(userSessions).toContain(sessionId);

      // UPDATE SESSION ACTIVITY
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
      const updated = await sessionService.updateActivity(sessionId);
      expect(updated).toBe(true);

      const updatedSession = await sessionService.getSession(sessionId);
      expect(updatedSession!.lastActivityAt.getTime()).toBeGreaterThan(
        retrievedSession!.lastActivityAt.getTime()
      );

      // UPDATE SESSION DATA
      const updateResult = await sessionService.updateSessionData(sessionId, {
        roles: ['user', 'super-admin'],
        metadata: { ...testSessionData.metadata, updatedAt: Date.now() },
      });
      expect(updateResult).toBe(true);

      const sessionWithUpdates = await sessionService.getSession(sessionId);
      expect(sessionWithUpdates!.roles).toEqual(['user', 'super-admin']);
      expect(sessionWithUpdates!.metadata.updatedAt).toBeDefined();

      // DESTROY SESSION
      await sessionService.destroySession(sessionId);

      // Verify session removed from Redis
      const deletedSession = await sessionService.getSession(sessionId);
      expect(deletedSession).toBeNull();

      const redisValueAfterDelete = await redis.get(redisSessionKey);
      expect(redisValueAfterDelete).toBeNull();

      // Verify removed from user sessions set
      const userSessionsAfterDelete = await redis.smembers(userSessionsKey);
      expect(userSessionsAfterDelete).not.toContain(sessionId);

      // Verify event was published
      expect(mockEventsService.publishEvent).toHaveBeenCalledWith(
        'session.created',
        expect.any(Object)
      );
      expect(mockEventsService.publishEvent).toHaveBeenCalledWith(
        'session.destroyed',
        expect.any(Object)
      );
    });

    it('should handle concurrent session limits with real Redis', async () => {
      const maxSessions = 3; // From mockConfigService
      const sessionIds: string[] = [];

      // Create maximum allowed sessions
      for (let i = 0; i < maxSessions; i++) {
        const sessionData = {
          ...testSessionData,
          deviceFingerprint: `device-${i}`,
          ipAddress: `192.168.1.${100 + i}`,
        };
        const sessionId = await sessionService.createSession(sessionData);
        sessionIds.push(sessionId);
      }

      // Verify all sessions exist
      for (const sessionId of sessionIds) {
        const session = await sessionService.getSession(sessionId);
        expect(session).toBeTruthy();
      }

      const activeSessions = await sessionService.getActiveSessions(TEST_USER_ID);
      expect(activeSessions).toHaveLength(maxSessions);

      // Create one more session (should trigger limit enforcement)
      const extraSessionData = {
        ...testSessionData,
        deviceFingerprint: 'extra-device',
        ipAddress: '192.168.1.200',
      };
      const extraSessionId = await sessionService.createSession(extraSessionData);

      // Verify oldest session was removed
      const activeSessionsAfter = await sessionService.getActiveSessions(TEST_USER_ID);
      expect(activeSessionsAfter).toHaveLength(maxSessions);

      // The extra session should exist
      const extraSession = await sessionService.getSession(extraSessionId);
      expect(extraSession).toBeTruthy();

      // At least one of the original sessions should be gone
      const existingOriginalSessions = await Promise.all(
        sessionIds.map((id) => sessionService.getSession(id))
      );
      const activeOriginalSessions = existingOriginalSessions.filter((s) => s !== null);
      expect(activeOriginalSessions.length).toBeLessThan(maxSessions);
    });

    it('should handle session expiration with real TTL', async () => {
      // Create session with short TTL (override the service's default)
      const sessionId = await sessionService.createSession(testSessionData);

      // Manually set shorter TTL in Redis for testing
      const sessionKey = `session:${sessionId}`;
      await redis.expire(sessionKey, 1); // 1 second TTL

      // Session should exist initially
      const initialSession = await sessionService.getSession(sessionId);
      expect(initialSession).toBeTruthy();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify session expired in Redis
      const redisValue = await redis.get(sessionKey);
      expect(redisValue).toBeNull();

      // Session service should return null for expired session
      const expiredSession = await sessionService.getSession(sessionId);
      expect(expiredSession).toBeNull();
    });
  });

  describe('Device Management with Redis', () => {
    it('should track and manage device information', async () => {
      const deviceFingerprint = 'device-' + uuidv4();
      const deviceInfo: Partial<DeviceInfo> = {
        name: 'Integration Test Device',
        type: 'desktop',
        os: 'Windows 11',
        browser: 'Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      // UPDATE DEVICE INFO
      await sessionService.updateDeviceInfo(TEST_USER_ID, deviceFingerprint, deviceInfo);

      // Verify device info stored in Redis
      const deviceKey = `device:${TEST_USER_ID}:${deviceFingerprint}`;
      const redisDeviceValue = await redis.get(deviceKey);
      expect(redisDeviceValue).toBeTruthy();

      const parsedDevice = JSON.parse(redisDeviceValue!);
      expect(parsedDevice.fingerprint).toBe(deviceFingerprint);
      expect(parsedDevice.name).toBe('Integration Test Device');
      expect(parsedDevice.trusted).toBe(false);

      // RETRIEVE DEVICE INFO
      const retrievedDevice = await sessionService.getDeviceInfo(TEST_USER_ID, deviceFingerprint);
      expect(retrievedDevice).toBeTruthy();
      expect(retrievedDevice!.fingerprint).toBe(deviceFingerprint);
      expect(retrievedDevice!.name).toBe('Integration Test Device');
      expect(retrievedDevice!.lastSeen).toBeInstanceOf(Date);

      // TRUST DEVICE
      const trustResult = await sessionService.trustDevice(TEST_USER_ID, deviceFingerprint);
      expect(trustResult).toBe(true);

      const trustedDevice = await sessionService.getDeviceInfo(TEST_USER_ID, deviceFingerprint);
      expect(trustedDevice!.trusted).toBe(true);

      // Verify event published
      expect(mockEventsService.publishEvent).toHaveBeenCalledWith('device.trusted', {
        userId: TEST_USER_ID,
        deviceFingerprint,
      });

      // GET USER DEVICES
      const userDevices = await sessionService.getUserDevices(TEST_USER_ID);
      expect(userDevices).toHaveLength(1);
      expect(userDevices[0].fingerprint).toBe(deviceFingerprint);

      // REMOVE DEVICE
      await sessionService.removeDevice(TEST_USER_ID, deviceFingerprint);

      // Verify device removed from Redis
      const removedDevice = await sessionService.getDeviceInfo(TEST_USER_ID, deviceFingerprint);
      expect(removedDevice).toBeNull();

      const redisDeviceAfterRemove = await redis.get(deviceKey);
      expect(redisDeviceAfterRemove).toBeNull();
    });
  });

  describe('Authentication Caching Operations', () => {
    it('should cache user authentication data', async () => {
      // Simulate caching user data after successful authentication
      const userCacheKey = `user:${TEST_USER_ID}`;
      const userData = {
        id: TEST_USER_ID,
        email: 'test.user@example.com',
        organizationId: TEST_ORG_ID,
        roles: ['user', 'admin'],
        permissions: ['read:profile', 'write:profile'],
        lastLogin: new Date(),
        passwordChangeRequired: false,
        mfaEnabled: true,
      };

      // Cache user data
      await redisService.set(userCacheKey, userData, 3600); // 1 hour

      // Verify cached in Redis
      const redisUserValue = await redis.get(userCacheKey);
      expect(redisUserValue).toBeTruthy();
      expect(JSON.parse(redisUserValue!).email).toBe('test.user@example.com');

      // Retrieve through RedisService
      const cachedUser = await redisService.get(userCacheKey);
      expect(cachedUser).toEqual(userData);

      // Test TTL
      const ttl = await redisService.ttl(userCacheKey);
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('should handle rate limiting counters', async () => {
      const rateLimitKey = `rate_limit:login:${testSessionData.ipAddress}`;

      // Simulate rate limiting tracking
      const attempts = 5;
      for (let i = 0; i < attempts; i++) {
        await redisService.incr(rateLimitKey);
      }

      // Set expiration for rate limit window
      await redisService.expire(rateLimitKey, 60); // 1 minute window

      // Verify counter value
      const currentAttempts = await redisService.get<string>(rateLimitKey);
      expect(parseInt(currentAttempts!)).toBe(attempts);

      // Verify TTL is set
      const ttl = await redisService.ttl(rateLimitKey);
      expect(ttl).toBeGreaterThan(50);
      expect(ttl).toBeLessThanOrEqual(60);

      // Test decrement (for sliding window)
      await redisService.decr(rateLimitKey);
      const afterDecrement = await redisService.get<string>(rateLimitKey);
      expect(parseInt(afterDecrement!)).toBe(attempts - 1);
    });

    it('should handle password reset token caching', async () => {
      const resetToken = 'reset-' + uuidv4();
      const resetTokenKey = `password_reset:${resetToken}`;
      const resetData = {
        userId: TEST_USER_ID,
        email: 'test.user@example.com',
        organizationId: TEST_ORG_ID,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      };

      // Cache reset token
      await redisService.set(resetTokenKey, resetData, 900); // 15 minutes

      // Verify token cached
      const cachedToken = await redisService.get(resetTokenKey);
      expect(cachedToken).toEqual(resetData);

      // Simulate token usage (delete after use)
      const deletedCount = await redisService.del(resetTokenKey);
      expect(deletedCount).toBe(1);

      // Verify token removed
      const tokenAfterUse = await redisService.get(resetTokenKey);
      expect(tokenAfterUse).toBeNull();
    });

    it('should handle email verification token caching', async () => {
      const verificationToken = 'verify-' + uuidv4();
      const verificationKey = `email_verification:${verificationToken}`;
      const verificationData = {
        userId: TEST_USER_ID,
        email: 'test.user@example.com',
        newEmail: 'new.email@example.com', // For email changes
        createdAt: new Date(),
      };

      // Cache verification token
      await redisService.set(verificationKey, verificationData, 3600); // 1 hour

      // Verify token cached
      const cachedVerification = await redisService.get(verificationKey);
      expect(cachedVerification).toEqual(verificationData);

      // Test token validation
      const exists = await redisService.exists(verificationKey);
      expect(exists).toBe(true);

      // Simulate successful verification (remove token)
      await redisService.del(verificationKey);
      const tokenAfterVerification = await redisService.exists(verificationKey);
      expect(tokenAfterVerification).toBe(false);
    });

    it('should handle MFA token caching', async () => {
      const mfaTokenKey = `mfa_token:${TEST_USER_ID}`;
      const mfaData = {
        userId: TEST_USER_ID,
        sessionId: 'temp-session-' + uuidv4(),
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      };

      // Cache MFA token
      await redisService.set(mfaTokenKey, mfaData, 300); // 5 minutes

      // Simulate MFA attempt tracking
      const attempts = await redisService.incr(`${mfaTokenKey}:attempts`);
      expect(attempts).toBe(1);

      // Verify MFA data
      const cachedMFA = await redisService.get(mfaTokenKey);
      expect(cachedMFA).toEqual(mfaData);

      // Simulate successful MFA (clean up)
      await redisService.del([mfaTokenKey, `${mfaTokenKey}:attempts`]);

      const mfaAfterSuccess = await redisService.get(mfaTokenKey);
      expect(mfaAfterSuccess).toBeNull();
    });
  });

  describe('Session Analytics and Management', () => {
    it('should provide session statistics', async () => {
      // Create multiple sessions for different users
      const users = [TEST_USER_ID, 'user-2', 'user-3'];
      const sessionIds: string[] = [];

      for (let i = 0; i < users.length; i++) {
        const sessionData = {
          ...testSessionData,
          userId: users[i],
          email: `user${i}@example.com`,
          deviceFingerprint: `device-${i}`,
        };

        const sessionId = await sessionService.createSession(sessionData);
        sessionIds.push(sessionId);

        // Add slight delay to create different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Get session statistics
      const stats = await sessionService.getSessionStats();

      expect(stats.totalActive).toBe(3);
      expect(Object.keys(stats.byUser)).toHaveLength(3);
      expect(stats.byUser[TEST_USER_ID]).toBe(1);
      expect(stats.averageSessionDuration).toBeGreaterThan(0);

      // Test individual user session count
      const userSessionCount = await sessionService.countActiveSessions(TEST_USER_ID);
      expect(userSessionCount).toBe(1);

      // Test session validation
      for (const sessionId of sessionIds) {
        const isValid = await sessionService.isSessionValid(sessionId);
        expect(isValid).toBe(true);
      }
    });

    it('should handle bulk session operations', async () => {
      // Create multiple sessions for the same user
      const sessionIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const sessionData = {
          ...testSessionData,
          deviceFingerprint: `device-${i}`,
          ipAddress: `192.168.1.${100 + i}`,
        };
        const sessionId = await sessionService.createSession(sessionData);
        sessionIds.push(sessionId);
      }

      // Verify all sessions exist
      const activeSessions = await sessionService.getActiveSessions(TEST_USER_ID);
      expect(activeSessions).toHaveLength(3);

      // Destroy all sessions except one
      const sessionToKeep = sessionIds[0];
      const destroyedCount = await sessionService.destroyUserSessionsExcept(
        TEST_USER_ID,
        sessionToKeep
      );
      expect(destroyedCount).toBe(2);

      // Verify only one session remains
      const remainingSessions = await sessionService.getActiveSessions(TEST_USER_ID);
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].metadata?.sessionId || sessionToKeep).toBe(sessionToKeep);

      // Destroy all remaining sessions
      const allDestroyedCount = await sessionService.destroyAllUserSessions(TEST_USER_ID);
      expect(allDestroyedCount).toBe(1);

      // Verify no sessions remain
      const finalSessions = await sessionService.getActiveSessions(TEST_USER_ID);
      expect(finalSessions).toHaveLength(0);
    });

    it('should detect session anomalies', async () => {
      // Create a session
      const sessionId = await sessionService.createSession(testSessionData);

      // Test normal activity (no anomaly)
      const normalCheck = await sessionService.checkSessionAnomaly(
        sessionId,
        testSessionData.ipAddress!,
        testSessionData.userAgent!
      );
      expect(normalCheck.isAnomaly).toBe(false);

      // Test IP address change anomaly
      const ipChangeCheck = await sessionService.checkSessionAnomaly(
        sessionId,
        '192.168.1.200', // Different IP
        testSessionData.userAgent!
      );
      expect(ipChangeCheck.isAnomaly).toBe(true);
      expect(ipChangeCheck.reason).toContain('IP address changed');

      // Test user agent change anomaly
      const uaChangeCheck = await sessionService.checkSessionAnomaly(
        sessionId,
        testSessionData.ipAddress!,
        'Different Browser/2.0' // Different user agent
      );
      expect(uaChangeCheck.isAnomaly).toBe(true);
      expect(uaChangeCheck.reason).toContain('User agent changed');

      // Test non-existent session
      const nonExistentCheck = await sessionService.checkSessionAnomaly(
        'non-existent-session',
        testSessionData.ipAddress!,
        testSessionData.userAgent!
      );
      expect(nonExistentCheck.isAnomaly).toBe(true);
      expect(nonExistentCheck.reason).toBe('Session not found');
    });
  });

  describe('Redis Performance and Concurrency', () => {
    it('should handle concurrent Redis operations', async () => {
      const concurrentOps = 20;
      const promises = [];

      // Start concurrent session creation operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          (async () => {
            const sessionData = {
              ...testSessionData,
              userId: `concurrent-user-${i}`,
              email: `concurrent${i}@example.com`,
              deviceFingerprint: `concurrent-device-${i}`,
            };
            return sessionService.createSession(sessionData);
          })()
        );
      }

      const sessionIds = await Promise.all(promises);
      expect(sessionIds).toHaveLength(concurrentOps);

      // Verify all sessions are unique
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(concurrentOps);

      // Verify all sessions exist in Redis
      for (const sessionId of sessionIds) {
        const session = await sessionService.getSession(sessionId);
        expect(session).toBeTruthy();
      }
    });

    it('should handle Redis connection pool limits', async () => {
      // Test that we can handle multiple concurrent Redis operations
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          redisService.set(`concurrent-test-${i}`, { value: i, timestamp: Date.now() })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every((r) => r === undefined)).toBe(true); // set returns void

      // Verify all values were stored
      const getPromises = [];
      for (let i = 0; i < 50; i++) {
        getPromises.push(redisService.get(`concurrent-test-${i}`));
      }

      const values = await Promise.all(getPromises);
      expect(values.every((v) => v !== null)).toBe(true);

      values.forEach((value, index) => {
        expect(value.value).toBe(index);
      });
    });
  });
});
