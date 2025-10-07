import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

// Security test constants aligned with OWASP API Security Top 10 2023
export const SECURITY_TEST_CONSTANTS = {
  // API1:2023 - Broken Object Level Authorization
  UNAUTHORIZED_USER_ID: 'unauthorized-user-123',
  AUTHORIZED_USER_ID: 'authorized-user-456',

  // API4:2023 - Unrestricted Resource Consumption
  RATE_LIMIT_THRESHOLD: 100,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUEST_SIZE: 1048576, // 1MB

  // Performance benchmarks
  MAX_POLICY_EVALUATION_TIME: 50, // ms
  MAX_API_RESPONSE_TIME: 200, // ms

  // Security headers
  REQUIRED_SECURITY_HEADERS: [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'strict-transport-security',
    'content-security-policy',
  ],
};

// Test user roles aligned with SOC2/ISO27001 requirements
export enum TestUserRole {
  ADMIN = 'admin',
  POLICY_MANAGER = 'policy_manager',
  COMPLIANCE_OFFICER = 'compliance_officer',
  AUDITOR = 'auditor',
  VIEWER = 'viewer',
  EXTERNAL_AUDITOR = 'external_auditor',
}

export interface TestUser {
  id: string;
  email: string;
  roles: TestUserRole[];
  organizationId: string;
  permissions?: string[];
  mfaEnabled?: boolean;
}

// Test users for different scenarios
export const TEST_USERS: Record<TestUserRole, TestUser> = {
  [TestUserRole.ADMIN]: {
    id: 'admin-123',
    email: 'admin@test.com',
    roles: [TestUserRole.ADMIN],
    organizationId: 'org-123',
    permissions: ['*'],
    mfaEnabled: true,
  },
  [TestUserRole.POLICY_MANAGER]: {
    id: 'pm-123',
    email: 'policy.manager@test.com',
    roles: [TestUserRole.POLICY_MANAGER],
    organizationId: 'org-123',
    permissions: ['policy:*', 'framework:read', 'control:read'],
    mfaEnabled: true,
  },
  [TestUserRole.COMPLIANCE_OFFICER]: {
    id: 'co-123',
    email: 'compliance@test.com',
    roles: [TestUserRole.COMPLIANCE_OFFICER],
    organizationId: 'org-123',
    permissions: ['policy:read', 'framework:*', 'control:*', 'compliance:*'],
    mfaEnabled: true,
  },
  [TestUserRole.AUDITOR]: {
    id: 'auditor-123',
    email: 'auditor@test.com',
    roles: [TestUserRole.AUDITOR],
    organizationId: 'org-123',
    permissions: ['policy:read', 'framework:read', 'control:read', 'audit:*'],
    mfaEnabled: false,
  },
  [TestUserRole.VIEWER]: {
    id: 'viewer-123',
    email: 'viewer@test.com',
    roles: [TestUserRole.VIEWER],
    organizationId: 'org-123',
    permissions: ['policy:read', 'framework:read', 'control:read'],
    mfaEnabled: false,
  },
  [TestUserRole.EXTERNAL_AUDITOR]: {
    id: 'ext-auditor-123',
    email: 'external.auditor@partner.com',
    roles: [TestUserRole.EXTERNAL_AUDITOR],
    organizationId: 'partner-org-456',
    permissions: ['policy:read', 'audit:read'],
    mfaEnabled: true,
  },
};

// JWT token generation for testing
export class AuthTestHelper {
  private jwtService: JwtService;

  constructor() {
    this.jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'test-secret-key',
      signOptions: { expiresIn: '1h' },
    });
  }

  generateToken(user: TestUser, options?: { expiresIn?: string; invalid?: boolean }): string {
    if (options?.invalid) {
      return 'invalid.jwt.token';
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      organizationId: user.organizationId,
      permissions: user.permissions,
      mfaEnabled: user.mfaEnabled,
    };

    return this.jwtService.sign(
      payload,
      options?.expiresIn ? { expiresIn: options.expiresIn } : undefined
    );
  }

  generateExpiredToken(user: TestUser): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        organizationId: user.organizationId,
      },
      { expiresIn: '-1h' }
    );
  }
}

// Security testing utilities
export class SecurityTestHelper {
  static async testRateLimiting(
    app: INestApplication,
    endpoint: string,
    token: string,
    limit: number = SECURITY_TEST_CONSTANTS.RATE_LIMIT_THRESHOLD
  ): Promise<boolean> {
    const requests = [];

    // Make requests up to the limit
    for (let i = 0; i < limit + 5; i++) {
      requests.push(
        request(app.getHttpServer()).get(endpoint).set('Authorization', `Bearer ${token}`)
      );
    }

    const responses = await Promise.all(requests);

    // Check if rate limiting kicked in
    const rateLimited = responses.slice(limit).some((res) => res.status === 429);
    return rateLimited;
  }

  static async testSecurityHeaders(response: request.Response): Promise<string[]> {
    const missingHeaders = [];

    for (const header of SECURITY_TEST_CONSTANTS.REQUIRED_SECURITY_HEADERS) {
      if (!response.headers[header]) {
        missingHeaders.push(header);
      }
    }

    return missingHeaders;
  }

  static async testInputValidation(
    app: INestApplication,
    endpoint: string,
    method: 'post' | 'put' | 'patch',
    token: string,
    payloads: any[]
  ): Promise<{ payload: any; passed: boolean; error?: string }[]> {
    const results = [];

    for (const payload of payloads) {
      try {
        const response = await request(app.getHttpServer())
          [method](endpoint)
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        results.push({
          payload,
          passed: response.status < 400,
          error: response.status >= 400 ? response.body.message : undefined,
        });
      } catch (error) {
        results.push({
          payload,
          passed: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

// Compliance testing utilities
export class ComplianceTestHelper {
  static generateSOC2Policy() {
    return {
      title: 'SOC2 Information Security Policy',
      description: 'Policy for SOC2 Type II compliance',
      type: 'SECURITY',
      priority: 'HIGH',
      scope: 'ORGANIZATION',
      content: {
        sections: [
          {
            title: 'Purpose',
            content: 'To establish security controls for SOC2 compliance',
          },
          {
            title: 'Scope',
            content: 'Applies to all systems processing customer data',
          },
          {
            title: 'Controls',
            content: 'Implements CC6.1, CC6.2, CC6.3 controls',
          },
        ],
      },
      effectiveDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['soc2', 'security', 'compliance'],
      complianceMapping: {
        frameworks: ['SOC2'],
        controls: ['CC6.1', 'CC6.2', 'CC6.3'],
      },
    };
  }

  static generateISO27001Policy() {
    return {
      title: 'ISO 27001 Access Control Policy',
      description: 'Policy for ISO 27001 compliance',
      type: 'ACCESS_CONTROL',
      priority: 'HIGH',
      scope: 'ORGANIZATION',
      content: {
        sections: [
          {
            title: 'Purpose',
            content: 'To control access to information assets',
          },
          {
            title: 'Scope',
            content: 'Applies to all information systems',
          },
          {
            title: 'Controls',
            content: 'Implements A.9.1.1, A.9.1.2, A.9.2.1 controls',
          },
        ],
      },
      effectiveDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['iso27001', 'access-control', 'compliance'],
      complianceMapping: {
        frameworks: ['ISO27001'],
        controls: ['A.9.1.1', 'A.9.1.2', 'A.9.2.1'],
      },
    };
  }

  static validateAuditTrail(auditEntry: any): boolean {
    const requiredFields = [
      'timestamp',
      'userId',
      'action',
      'resource',
      'resourceId',
      'outcome',
      'ipAddress',
    ];

    return requiredFields.every((field) => auditEntry[field] !== undefined);
  }
}

// Performance testing utilities
export class PerformanceTestHelper {
  static async measureResponseTime(
    fn: () => Promise<any>
  ): Promise<{ result: any; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();

    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

    return { result, duration };
  }

  static async runLoadTest(
    fn: () => Promise<any>,
    concurrency: number,
    iterations: number
  ): Promise<{ avgDuration: number; maxDuration: number; minDuration: number; errors: number }> {
    const results: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const batch = [];

      for (let j = 0; j < concurrency; j++) {
        batch.push(
          PerformanceTestHelper.measureResponseTime(fn)
            .then(({ duration }) => results.push(duration))
            .catch(() => errors++)
        );
      }

      await Promise.all(batch);
    }

    return {
      avgDuration: results.reduce((a, b) => a + b, 0) / results.length,
      maxDuration: Math.max(...results),
      minDuration: Math.min(...results),
      errors,
    };
  }
}

// Test data builder for complex scenarios
export class TestDataBuilder {
  static createMockApp(): Partial<INestApplication> {
    return {
      useGlobalPipes: jest.fn(),
      use: jest.fn(),
      init: jest.fn(),
      getHttpServer: jest.fn(),
    };
  }

  static createMockRepository() {
    return {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
        getMany: jest.fn(),
        getOne: jest.fn(),
      })),
    };
  }
}

// Classes are already exported inline, no need for additional exports
