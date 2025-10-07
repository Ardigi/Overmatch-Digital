import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export class TestAuthHelper {
  /**
   * Create headers that simulate Kong authentication headers
   */
  static createAuthHeaders(user: {
    id: string;
    email: string;
    organizationId: string;
    roles: string[];
  }) {
    return {
      'x-user-id': user.id,
      'x-user-email': user.email,
      'x-organization-id': user.organizationId,
      'x-user-roles': user.roles.join(','),
    };
  }

  /**
   * Create a test request with authentication headers
   */
  static createAuthenticatedRequest(
    app: INestApplication,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    user: {
      id: string;
      email: string;
      organizationId: string;
      roles: string[];
    }
  ) {
    const headers = this.createAuthHeaders(user);
    return request(app.getHttpServer())[method](url).set(headers);
  }

  /**
   * Mock user data for tests
   */
  static getMockUsers() {
    const testOrganizationId = '123e4567-e89b-12d3-a456-426614174000';

    return {
      admin: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'admin@example.com',
        organizationId: testOrganizationId,
        roles: ['admin'],
      },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'user@example.com',
        organizationId: testOrganizationId,
        roles: ['user'],
      },
      complianceManager: {
        id: '123e4567-e89b-12d3-a456-426614174003',
        email: 'cm@example.com',
        organizationId: testOrganizationId,
        roles: ['compliance_manager'],
      },
      auditor: {
        id: '123e4567-e89b-12d3-a456-426614174004',
        email: 'auditor@example.com',
        organizationId: testOrganizationId,
        roles: ['auditor'],
      },
    };
  }
}