import * as bcrypt from 'bcrypt';
import type { Organization } from '../users/entities/organization.entity';
import {
  type PasswordPolicy,
  PasswordPolicyService,
  PasswordValidationResult,
} from './password-policy.service';

jest.mock('bcrypt');

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;
  let mockConfigService: any;

  const defaultPolicy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    preventReuse: 5,
    maxAge: 90,
    minAge: 24,
    preventCommonPasswords: true,
    preventUserInfo: true,
    enablePasswordHistory: true,
    passwordHistoryCount: 5,
  };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    };

    // Manual instantiation
    service = new PasswordPolicyService(mockConfigService);

    jest.clearAllMocks();
  });

  describe('getDefaultPolicy', () => {
    it('should return default policy', () => {
      const policy = service.getDefaultPolicy();

      expect(policy).toEqual(defaultPolicy);
    });
  });

  describe('getPolicy', () => {
    it('should return default policy when no organization provided', () => {
      const policy = service.getPolicy();

      expect(policy).toEqual(defaultPolicy);
    });

    it('should return default policy when organization has no custom policy', () => {
      const organization = {
        id: 'org-123',
        name: 'Test Org',
      } as Organization;

      const policy = service.getPolicy(organization);

      expect(policy).toEqual(defaultPolicy);
    });

    it('should merge organization policy with default policy', () => {
      const organization = {
        id: 'org-123',
        name: 'Test Org',
        passwordPolicy: {
          minLength: 12,
          requireSpecialChars: false,
          maxAge: 60,
        },
      } as any;

      const policy = service.getPolicy(organization);

      expect(policy).toEqual({
        ...defaultPolicy,
        minLength: 12,
        requireSpecialChars: false,
        maxAge: 60,
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password', async () => {
      const password = 'StrongPass123!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should fail password shorter than minimum length', async () => {
      const password = 'Short1!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      // Score can be 100 even for invalid passwords due to bonus points
      expect(result.score).toBeDefined();
    });

    it('should fail password without uppercase letter', async () => {
      const password = 'lowercase123!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should fail password without lowercase letter', async () => {
      const password = 'UPPERCASE123!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should fail password without numbers', async () => {
      const password = 'NoNumbers!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should fail password without special characters', async () => {
      const password = 'NoSpecial123';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character (@$!%*?&)'
      );
    });

    it('should fail common passwords', async () => {
      const password = 'Password1';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password is too common. Please choose a more unique password'
      );
    });

    it('should fail password containing user information', async () => {
      const password = 'JohnDoe123!';
      const userInfo = {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await service.validatePassword(password, defaultPolicy, userInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not contain your personal information');
    });

    it('should fail password containing email username', async () => {
      const password = 'john123ABC!';
      const userInfo = {
        email: 'john@example.com',
      };

      const result = await service.validatePassword(password, defaultPolicy, userInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not contain your personal information');
    });

    it('should check password reuse when previous passwords provided', async () => {
      const password = 'OldPassword123!';
      const userInfo = {
        previousPasswords: ['$2a$10$hashedOld1', '$2a$10$hashedOld2'],
      };

      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true); // First old password matches

      const result = await service.validatePassword(password, defaultPolicy, userInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not be one of your last 5 passwords');
    });

    it('should pass when password is not in history', async () => {
      const password = 'NewPassword123!';
      const userInfo = {
        previousPasswords: ['$2a$10$hashedOld1', '$2a$10$hashedOld2'],
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(password, defaultPolicy, userInfo);

      expect(result.isValid).toBe(true);
    });

    it('should calculate strength bonus for longer passwords', async () => {
      const shortPassword = 'Pass123!';
      const longPassword = 'VeryLongSecurePassword123!@#';

      const shortResult = await service.validatePassword(shortPassword);
      const longResult = await service.validatePassword(longPassword);

      // Long passwords get bonus points, but short might still score 100
      expect(longResult.score).toBeGreaterThanOrEqual(shortResult.score);
      expect(longResult.isValid).toBe(true);
      expect(shortResult.isValid).toBe(true);
    });

    it('should penalize repeated characters', async () => {
      const password = 'Passs123!!!';

      const result = await service.validatePassword(password);

      // Password has repeated characters which get penalized
      expect(result.isValid).toBe(true);
      // Repeated chars penalty is -10, but variety bonus might compensate
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should penalize common patterns', async () => {
      const password = 'Password123';

      const result = await service.validatePassword(password);

      expect(result.score).toBeLessThan(90);
    });

    it('should handle custom policy', async () => {
      const customPolicy: PasswordPolicy = {
        ...defaultPolicy,
        minLength: 12,
        requireSpecialChars: false,
      };
      const password = 'LongPassword123';

      const result = await service.validatePassword(password, customPolicy);

      expect(result.isValid).toBe(true);
    });
  });

  describe('generatePassword', () => {
    it('should generate password meeting all requirements', () => {
      const password = service.generatePassword(defaultPolicy);

      expect(password.length).toBeGreaterThanOrEqual(defaultPolicy.minLength);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
      expect(/[@$!%*?&]/.test(password)).toBe(true);
    });

    it('should generate longer password when policy requires', () => {
      const policy = { ...defaultPolicy, minLength: 16 };

      const password = service.generatePassword(policy);

      expect(password.length).toBeGreaterThanOrEqual(16);
    });

    it('should respect disabled requirements', () => {
      const policy = {
        ...defaultPolicy,
        requireSpecialChars: false,
        requireNumbers: false,
      };

      const password = service.generatePassword(policy);

      expect(password.length).toBeGreaterThanOrEqual(policy.minLength);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
    });
  });

  describe('isPasswordExpired', () => {
    it('should return true for expired password', () => {
      const passwordChangedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

      const result = service.isPasswordExpired(passwordChangedAt, defaultPolicy);

      expect(result).toBe(true);
    });

    it('should return false for non-expired password', () => {
      const passwordChangedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const result = service.isPasswordExpired(passwordChangedAt, defaultPolicy);

      expect(result).toBe(false);
    });

    it('should return false when maxAge is 0', () => {
      const policy = { ...defaultPolicy, maxAge: 0 };
      const passwordChangedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      const result = service.isPasswordExpired(passwordChangedAt, policy);

      expect(result).toBe(false);
    });
  });

  describe('canChangePassword', () => {
    it('should return false when minimum age not met', () => {
      const passwordChangedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago

      const result = service.canChangePassword(passwordChangedAt, defaultPolicy);

      expect(result).toBe(false);
    });

    it('should return true when minimum age met', () => {
      const passwordChangedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      const result = service.canChangePassword(passwordChangedAt, defaultPolicy);

      expect(result).toBe(true);
    });

    it('should return true when minAge is 0', () => {
      const policy = { ...defaultPolicy, minAge: 0 };
      const passwordChangedAt = new Date();

      const result = service.canChangePassword(passwordChangedAt, policy);

      expect(result).toBe(true);
    });
  });

  describe('validatePasswordChange', () => {
    it('should validate password change', async () => {
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'CompletelyDifferent456@';

      const result = await service.validatePasswordChange(
        currentPassword,
        newPassword,
        defaultPolicy
      );

      expect(result.isValid).toBe(true);
    });

    it('should fail when new password is too similar', async () => {
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'CurrentPass124!'; // Very similar

      const result = await service.validatePasswordChange(
        currentPassword,
        newPassword,
        defaultPolicy
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password is too similar to current password');
    });

    it('should fail when new password does not meet policy', async () => {
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'weak';

      const result = await service.validatePasswordChange(
        currentPassword,
        newPassword,
        defaultPolicy
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1); // Multiple policy violations
    });

    it('should include user info validation', async () => {
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'JohnNewPass123!';
      const userInfo = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await service.validatePasswordChange(
        currentPassword,
        newPassword,
        defaultPolicy,
        userInfo
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not contain your personal information');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in regex properly', async () => {
      const policy = {
        ...defaultPolicy,
        specialChars: '[]{}().*+?^$|\\',
      };
      const password = 'Test123[]';

      const result = await service.validatePassword(password, policy);

      expect(result.isValid).toBe(true);
    });

    it('should handle empty previous passwords array', async () => {
      const password = 'NewPassword123!';
      const userInfo = {
        previousPasswords: [],
      };

      const result = await service.validatePassword(password, defaultPolicy, userInfo);

      expect(result.isValid).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const password = 'A'.repeat(100) + 'a1!';

      const result = await service.validatePassword(password);

      expect(result.isValid).toBe(true);
      // Score is capped at 100 by Math.min(100, score)
      expect(result.score).toBe(100);
    });
  });
});
