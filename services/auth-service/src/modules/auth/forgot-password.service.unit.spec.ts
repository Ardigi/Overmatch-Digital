import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ForgotPasswordService } from './forgot-password.service';
import type { PasswordPolicyService } from './password-policy.service';
import type { RefreshTokenService } from './refresh-token.service';

jest.mock('crypto');
jest.mock('bcrypt');

describe('ForgotPasswordService (Unit)', () => {
  let service: ForgotPasswordService;
  let userRepository: any;
  let configService: ConfigService;
  let eventEmitter: EventEmitter2;
  let passwordPolicyService: PasswordPolicyService;
  let refreshTokenService: RefreshTokenService;

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockPasswordPolicyService = {
    getPolicy: jest.fn(),
    validatePassword: jest.fn(),
  };

  const mockRefreshTokenService = {
    revokeRefreshToken: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
    resetPasswordToken: null,
    resetPasswordExpires: null,
    previousPasswords: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    organizationId: 'org-123',
    organization: {
      id: 'org-123',
      name: 'Test Organization',
    },
  };

  const mockPasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    enablePasswordHistory: true,
    passwordHistoryCount: 5,
  };

  beforeEach(() => {
    // Create instance manually without TestingModule
    service = new ForgotPasswordService(
      mockUserRepository as any,
      mockConfigService as any,
      mockEventEmitter as any,
      mockPasswordPolicyService as any,
      mockRefreshTokenService as any
    );

    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('http://localhost:3000');
  });

  describe('initiatePasswordReset', () => {
    it('should call requestPasswordReset', async () => {
      const requestSpy = jest.spyOn(service, 'requestPasswordReset').mockResolvedValue();

      await service.initiatePasswordReset('test@example.com');

      expect(requestSpy).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('requestPasswordReset', () => {
    const mockToken = 'mock-random-token';
    const mockHashedToken = 'mock-hashed-token';

    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      });
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockHashedToken),
      });
    });

    it('should generate reset token for active user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.requestPasswordReset('test@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['organization'],
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resetPasswordToken: mockHashedToken,
          resetPasswordExpires: expect.any(Date),
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset.requested',
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          resetToken: mockHashedToken,
          resetLink: `http://localhost:3000/auth/reset-password?token=${mockToken}`,
        })
      );
    });

    it('should handle lowercase email', async () => {
      // Use a fresh copy of mockUser to avoid contamination from previous tests
      const freshMockUser = { ...mockUser, resetPasswordExpires: null };
      mockUserRepository.findOne.mockResolvedValue(freshMockUser);

      await service.requestPasswordReset('TEST@EXAMPLE.COM');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['organization'],
      });
    });

    it('should silently return for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.requestPasswordReset('nonexistent@example.com');

      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should silently return for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: 'inactive' };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);

      await service.requestPasswordReset('test@example.com');

      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if recent reset was requested', async () => {
      const userWithRecentReset = {
        ...mockUser,
        resetPasswordExpires: new Date(Date.now() + 59 * 60 * 1000), // 59 minutes from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithRecentReset);

      await expect(service.requestPasswordReset('test@example.com')).rejects.toThrow(
        new BadRequestException(
          'Password reset already requested. Please check your email or try again later.'
        )
      );
    });

    it('should allow new reset if previous is close to expiry', async () => {
      const userWithExpiringReset = {
        ...mockUser,
        resetPasswordExpires: new Date(Date.now() + 1 * 60 * 1000), // 1 minute from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiringReset);
      mockUserRepository.save.mockResolvedValue(userWithExpiringReset);

      await service.requestPasswordReset('test@example.com');

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashed-token'),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
    });

    it('should reset password with valid token', async () => {
      const validUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(validUser);
      mockUserRepository.save.mockResolvedValue(validUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 85,
      });

      await service.resetPassword('valid-token', 'NewSecurePassword123!');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'new-hashed-password',
          resetPasswordToken: null,
          resetPasswordExpires: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(validUser.id);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.reset.completed',
        expect.objectContaining({
          userId: validUser.id,
          organizationId: validUser.organizationId,
        })
      );
    });

    it('should throw BadRequestException for missing token or password', async () => {
      await expect(service.resetPassword('', 'password')).rejects.toThrow(
        new BadRequestException('Token and new password are required')
      );

      await expect(service.resetPassword('token', '')).rejects.toThrow(
        new BadRequestException('Token and new password are required')
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };
      mockUserRepository.findOne.mockResolvedValue(expiredUser);

      await expect(service.resetPassword('valid-token', 'NewPassword123!')).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
    });

    it('should throw BadRequestException for invalid password', async () => {
      const validUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(validUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password is too weak'],
        score: 40,
      });

      await expect(service.resetPassword('valid-token', 'weak')).rejects.toThrow(
        BadRequestException
      );

      try {
        await service.resetPassword('valid-token', 'weak');
      } catch (error) {
        expect(error.response).toEqual({
          message: 'Password does not meet requirements',
          errors: ['Password is too weak'],
          score: 40,
        });
      }
    });

    it('should add old password to history when enabled', async () => {
      const validUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
        previousPasswords: ['old-hash-1'],
      };
      mockUserRepository.findOne.mockResolvedValue(validUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 85,
      });

      await service.resetPassword('valid-token', 'NewSecurePassword123!');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: ['old-hash-1', '$2a$12$hashedpassword'],
        })
      );
    });

    it('should limit password history count', async () => {
      const validUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
        previousPasswords: ['old-1', 'old-2', 'old-3', 'old-4', 'old-5'],
      };
      mockUserRepository.findOne.mockResolvedValue(validUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 85,
      });

      await service.resetPassword('valid-token', 'NewSecurePassword123!');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: ['old-2', 'old-3', 'old-4', 'old-5', '$2a$12$hashedpassword'],
        })
      );
    });
  });

  describe('validateResetToken', () => {
    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashed-token'),
      });
    });

    it('should return true for valid token', async () => {
      const validUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(validUser);

      const result = await service.validateResetToken('valid-token');

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateResetToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() - 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(expiredUser);

      const result = await service.validateResetToken('valid-token');

      expect(result).toBe(false);
    });

    it('should return false for empty token', async () => {
      const result = await service.validateResetToken('');

      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
    });

    it('should change password for authenticated user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 85,
      });

      await service.changePassword('user-123', 'currentPassword', 'NewPassword123!');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'new-hashed-password',
        })
      );
      // Note: changePassword doesn't revoke refresh tokens - that's only done in resetPassword
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'password.changed',
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('non-existent', 'currentPassword', 'NewPassword123!')
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrongPassword', 'NewPassword123!')
      ).rejects.toThrow(new BadRequestException('Current password is incorrect'));
    });

    it('should throw BadRequestException for invalid new password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password is too weak'],
        score: 40,
      });

      await expect(service.changePassword('user-123', 'currentPassword', 'weak')).rejects.toThrow(
        BadRequestException
      );

      try {
        await service.changePassword('user-123', 'currentPassword', 'weak');
      } catch (error) {
        expect(error.response).toEqual({
          message: 'Password does not meet requirements',
          errors: ['Password is too weak'],
          score: 40,
        });
      }
    });

    it('should manage password history when enabled', async () => {
      const userWithHistory = {
        ...mockUser,
        previousPasswords: ['old-1', 'old-2'],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithHistory);
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 85,
      });

      await service.changePassword('user-123', 'currentPassword', 'NewPassword123!');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: ['old-1', 'old-2', userWithHistory.password],
        })
      );
    });
  });
});
