import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserStatus } from '../users/entities/user.entity';
import { ForgotPasswordService } from './forgot-password.service';
import { PasswordPolicyService } from './password-policy.service';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('crypto');
jest.mock('bcrypt');

describe('ForgotPasswordService', () => {
  let service: ForgotPasswordService;
  let mockUserRepository: any;
  let mockConfigService: any;
  let mockEventEmitter: any;
  let mockPasswordPolicyService: any;
  let mockRefreshTokenService: any;

  const createMockUser = () => ({
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    status: UserStatus.ACTIVE,
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
  });

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
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((user) => Promise.resolve(JSON.parse(JSON.stringify(user)))),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockPasswordPolicyService = {
      getPolicy: jest.fn(),
      validatePassword: jest.fn(),
    };

    mockRefreshTokenService = {
      revokeRefreshToken: jest.fn(),
    };

    // Manual instantiation
    service = new ForgotPasswordService(
      mockUserRepository,
      mockConfigService,
      mockEventEmitter,
      mockPasswordPolicyService,
      mockRefreshTokenService
    );

    jest.clearAllMocks();
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
      const mockUser = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(createMockUser());
      mockUserRepository.save.mockImplementation((user) =>
        Promise.resolve(JSON.parse(JSON.stringify(user)))
      );

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
      const mockUser = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(createMockUser());
      mockUserRepository.save.mockImplementation((user) =>
        Promise.resolve(JSON.parse(JSON.stringify(user)))
      );

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
      const inactiveUser = { ...createMockUser(), status: UserStatus.INACTIVE };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);

      await service.requestPasswordReset('test@example.com');

      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if recent reset was requested', async () => {
      const userWithRecentReset = {
        ...createMockUser(),
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
        ...createMockUser(),
        resetPasswordExpires: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiringReset);
      mockUserRepository.save.mockResolvedValue(userWithExpiringReset);

      await service.requestPasswordReset('test@example.com');

      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const token = 'reset-token';
    const hashedToken = 'hashed-reset-token';
    const newPassword = 'NewSecurePassword123!';

    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashedToken),
      });
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 4,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhashed');
    });

    it('should reset password with valid token', async () => {
      const userWithToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);
      mockUserRepository.save.mockResolvedValue(userWithToken);

      await service.resetPassword(token, newPassword);

      expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalledWith(
        newPassword,
        mockPasswordPolicy,
        expect.objectContaining({
          email: userWithToken.email,
          firstName: userWithToken.firstName,
          lastName: userWithToken.lastName,
        })
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: '$2a$12$newhashed',
          resetPasswordToken: null,
          resetPasswordExpires: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
      );
      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(userWithToken.id);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('password.reset.completed', {
        userId: userWithToken.id,
        organizationId: userWithToken.organizationId,
        changedBy: userWithToken,
      });
    });

    it('should throw BadRequestException for missing token or password', async () => {
      await expect(service.resetPassword('', newPassword)).rejects.toThrow(
        new BadRequestException('Token and new password are required')
      );
      await expect(service.resetPassword(token, '')).rejects.toThrow(
        new BadRequestException('Token and new password are required')
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const userWithExpiredToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() - 3600000), // 1 hour ago
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiredToken);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
    });

    it('should throw BadRequestException for invalid password', async () => {
      const userWithToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password must contain at least one uppercase letter'],
        score: 2,
      });

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(BadRequestException);
    });

    it('should add old password to history when enabled', async () => {
      const userWithToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
        previousPasswords: ['$2a$12$oldpassword1'],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);
      mockUserRepository.save.mockResolvedValue(userWithToken);

      await service.resetPassword(token, newPassword);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: ['$2a$12$oldpassword1', '$2a$12$hashedpassword'],
        })
      );
    });

    it('should limit password history count', async () => {
      const userWithToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
        previousPasswords: [
          '$2a$12$old1',
          '$2a$12$old2',
          '$2a$12$old3',
          '$2a$12$old4',
          '$2a$12$old5',
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);
      mockUserRepository.save.mockResolvedValue(userWithToken);

      await service.resetPassword(token, newPassword);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: [
            '$2a$12$old2',
            '$2a$12$old3',
            '$2a$12$old4',
            '$2a$12$old5',
            '$2a$12$hashedpassword',
          ],
        })
      );
    });
  });

  describe('validateResetToken', () => {
    const token = 'reset-token';
    const hashedToken = 'hashed-reset-token';

    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashedToken),
      });
    });

    it('should return true for valid token', async () => {
      const userWithToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);

      const result = await service.validateResetToken(token);

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateResetToken(token);

      expect(result).toBe(false);
    });

    it('should return false for expired token', async () => {
      const userWithExpiredToken = {
        ...createMockUser(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() - 3600000),
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiredToken);

      const result = await service.validateResetToken(token);

      expect(result).toBe(false);
    });

    it('should return false for empty token', async () => {
      const result = await service.validateResetToken('');

      expect(result).toBe(false);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewSecurePassword123!';

    beforeEach(() => {
      mockPasswordPolicyService.getPolicy.mockReturnValue(mockPasswordPolicy);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
        score: 4,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhashed');
    });

    it('should change password for authenticated user', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockImplementation((user) =>
        Promise.resolve(JSON.parse(JSON.stringify(user)))
      );

      await service.changePassword('user-123', currentPassword, newPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, '$2a$12$hashedpassword');
      expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: '$2a$12$newhashed',
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('password.changed', {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        changedBy: expect.objectContaining({
          id: mockUser.id,
          password: '$2a$12$newhashed',
          previousPasswords: ['$2a$12$hashedpassword'],
        }),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('invalid-id', currentPassword, newPassword)
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      mockUserRepository.findOne.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrong-password', newPassword)
      ).rejects.toThrow(new BadRequestException('Current password is incorrect'));
    });

    it('should throw BadRequestException for invalid new password', async () => {
      mockUserRepository.findOne.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password is too weak'],
        score: 1,
      });

      await expect(service.changePassword('user-123', currentPassword, 'weak')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should manage password history when enabled', async () => {
      const userWithHistory = {
        ...createMockUser(),
        previousPasswords: ['$2a$12$old1', '$2a$12$old2'],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithHistory);
      mockUserRepository.save.mockImplementation((user) => Promise.resolve({ ...user }));

      await service.changePassword('user-123', currentPassword, newPassword);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          previousPasswords: ['$2a$12$old1', '$2a$12$old2', '$2a$12$hashedpassword'],
        })
      );
    });
  });
});
