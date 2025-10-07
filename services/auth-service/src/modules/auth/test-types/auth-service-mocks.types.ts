import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { MfaService } from '../../mfa/mfa.service';
import type { DeviceFingerprintService } from '../../security/device-fingerprint.service';
import { SessionService } from '../../sessions/session.service';
import { UsersService } from '../../users/users.service';
import type { AnomalyDetectionService } from '../anomaly-detection.service';
import type { RefreshTokenService } from '../refresh-token.service';

// Properly typed mock interfaces
export type MockJwtService = jest.Mocked<Pick<JwtService, 'signAsync' | 'verify'>>;

export type MockConfigService = jest.Mocked<Pick<ConfigService, 'get'>>;

export type MockUsersService = jest.Mocked<
  Pick<
    UsersService,
    | 'findByEmail'
    | 'findOne'
    | 'create'
    | 'updateLastLogin'
    | 'createFirstUser'
    | 'count'
    | 'findAll'
    | 'updatePassword'
  >
>;

export type MockRefreshTokenService = jest.Mocked<
  Pick<
    RefreshTokenService,
    'createRefreshToken' | 'validateRefreshToken' | 'revokeRefreshToken' | 'rotateRefreshToken'
  >
>;

export type MockMfaService = jest.Mocked<Pick<MfaService, 'getUserMFAStatus' | 'verifyToken'>>;

export type MockSessionService = jest.Mocked<
  Pick<
    SessionService,
    | 'createSession'
    | 'updateSessionData'
    | 'destroySession'
    | 'destroyAllUserSessions'
    | 'updateDeviceInfo'
    | 'getSession'
    | 'updateActivity'
  >
>;

export type MockDeviceFingerprintService = jest.Mocked<
  Pick<DeviceFingerprintService, 'generateFingerprint'>
>;

export type MockAnomalyDetectionService = jest.Mocked<
  Pick<
    AnomalyDetectionService,
    'detectAnomalies' | 'recordLoginEvent' | 'clearFailedAttempts'
  >
>;

export type MockEventEmitter = jest.Mocked<Pick<EventEmitter2, 'emit'>>;

// For monitoring services, we create simple mock types since the actual services might not export all methods
export type MockMetricsService = {
  recordCounter: jest.Mock;
  recordHistogram: jest.Mock;
  recordGauge: jest.Mock;
};

export type MockTracingService = {
  startSpan: jest.Mock;
};

export type MockLoggingService = {
  log: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
};

// Factory functions for creating properly typed mocks
export function createMockJwtService(): MockJwtService {
  return {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };
}

export function createMockConfigService(): MockConfigService {
  return {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        JWT_EXPIRES_IN: '30m',
        SETUP_KEY: 'default-setup-key-change-in-production',
      };
      return config[key] || defaultValue;
    }),
  };
}

export function createMockUsersService(): MockUsersService {
  return {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateLastLogin: jest.fn(),
    createFirstUser: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    updatePassword: jest.fn(),
  };
}

export function createMockRefreshTokenService(): MockRefreshTokenService {
  return {
    createRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
  };
}

export function createMockMfaService(): MockMfaService {
  return {
    getUserMFAStatus: jest.fn(),
    verifyToken: jest.fn(),
  };
}

export function createMockSessionService(): MockSessionService {
  return {
    createSession: jest.fn().mockResolvedValue('session-123'),
    updateSessionData: jest.fn(),
    destroySession: jest.fn(),
    destroyAllUserSessions: jest.fn(),
    updateDeviceInfo: jest.fn(),
    getSession: jest.fn(),
    updateActivity: jest.fn(),
  };
}

export function createMockDeviceFingerprintService(): MockDeviceFingerprintService {
  return {
    generateFingerprint: jest.fn().mockReturnValue({
      hash: 'device-fingerprint-hash',
      components: {
        browser: { name: 'Chrome' },
        os: { name: 'Windows' },
        device: { type: 'desktop' },
      },
    }),
  };
}

export function createMockAnomalyDetectionService(): MockAnomalyDetectionService {
  return {
    detectAnomalies: jest.fn().mockResolvedValue({
      shouldBlock: false,
      requireMfa: false,
      anomalies: [],
      riskScore: 0,
      actions: [],
    }),
    recordLoginEvent: jest.fn().mockResolvedValue(undefined),
    clearFailedAttempts: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockEventEmitter(): MockEventEmitter {
  return {
    emit: jest.fn(),
  };
}

export function createMockMetricsService(): MockMetricsService {
  return {
    recordCounter: jest.fn(),
    recordHistogram: jest.fn(),
    recordGauge: jest.fn(),
  };
}

export function createMockTracingService(): MockTracingService {
  return {
    startSpan: jest.fn().mockReturnValue({
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      end: jest.fn(),
    }),
  };
}

export function createMockLoggingService(): MockLoggingService {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}