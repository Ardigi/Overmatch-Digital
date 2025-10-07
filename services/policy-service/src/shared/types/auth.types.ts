/**
 * Authentication and authorization types
 */

export interface UserContext {
  userId: string;
  email: string;
  organizationId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface SystemUserContext extends UserContext {
  userId: 'system';
  email: 'system@example.com';
  isSystem: true;
  roles: string[];
  permissions: string[];
}

export const SYSTEM_USER: SystemUserContext = {
  userId: 'system',
  email: 'system@example.com',
  isSystem: true,
  roles: ['admin', 'system'],
  permissions: ['*'],
};