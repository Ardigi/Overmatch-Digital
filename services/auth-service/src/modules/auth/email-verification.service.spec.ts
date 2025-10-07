import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

// Mock crypto before importing the service
jest.mock('crypto');

import { type User, UserStatus } from '../users/entities/user.entity';
// Import after mocks are set up
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let mockUserRepository: any;
  let mockConfigService: any;
  let mockEventEmitter: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    emailVerified: false,
    emailVerifiedAt: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    status: UserStatus.PENDING,
    organizationId: 'org-123',
    organization: {
      id: 'org-123',
      name: 'Test Organization',
    },
  };

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    // Manual instantiation
    service = new EmailVerificationService(mockUserRepository, mockConfigService, mockEventEmitter);

    jest.clearAllMocks();
  });

  describe('generateVerificationToken', () => {
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
      mockConfigService.get.mockReturnValue('http://localhost:3000');
    });

    it('should generate verification token for unverified user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const token = await service.generateVerificationToken('user-123');

      expect(token).toBe(mockToken);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        relations: ['organization'],
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resetPasswordToken: mockHashedToken,
          resetPasswordExpires: expect.any(Date),
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'email.verification.requested',
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          verificationToken: mockHashedToken,
          verificationLink: `http://localhost:3000/auth/verify-email?token=${mockToken}`,
        })
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.generateVerificationToken('invalid-id')).rejects.toThrow(
        new NotFoundException('User not found')
      );
    });

    it('should throw BadRequestException if email already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser);

      await expect(service.generateVerificationToken('user-123')).rejects.toThrow(
        new BadRequestException('Email already verified')
      );
    });

    it('should use custom frontend URL from config', async () => {
      mockConfigService.get.mockReturnValue('https://app.example.com');
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.generateVerificationToken('user-123');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'email.verification.requested',
        expect.objectContaining({
          verificationLink: `https://app.example.com/auth/verify-email?token=${mockToken}`,
        })
      );
    });
  });

  describe('verifyEmail', () => {
    const token = 'verification-token';
    const hashedToken = 'hashed-verification-token';

    beforeEach(() => {
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashedToken),
      });
    });

    it('should verify email with valid token', async () => {
      const userWithToken = {
        ...mockUser,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithToken);
      mockUserRepository.save.mockResolvedValue({
        ...userWithToken,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        resetPasswordToken: null,
        resetPasswordExpires: null,
        status: UserStatus.ACTIVE,
      });

      const result = await service.verifyEmail(token);

      expect(result).toEqual({
        success: true,
        message: 'Email verified successfully',
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
          resetPasswordToken: null,
          resetPasswordExpires: null,
          status: UserStatus.ACTIVE,
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('email.verified', {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        email: mockUser.email,
      });
    });

    it('should throw BadRequestException for missing token', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(
        new BadRequestException('Verification token is required')
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail(token)).rejects.toThrow(
        new BadRequestException('Invalid verification token')
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() - 3600000), // 1 hour ago
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiredToken);

      await expect(service.verifyEmail(token)).rejects.toThrow(
        new BadRequestException('Verification token has expired')
      );
    });

    it('should throw BadRequestException if email already verified', async () => {
      const verifiedUser = {
        ...mockUser,
        emailVerified: true,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser);

      await expect(service.verifyEmail(token)).rejects.toThrow(
        new BadRequestException('Email already verified')
      );
    });

    it('should not change status if user is already active', async () => {
      const activeUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000),
      };
      mockUserRepository.findOne.mockResolvedValue(activeUser);
      mockUserRepository.save.mockResolvedValue(activeUser);

      await service.verifyEmail(token);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UserStatus.ACTIVE, // Should remain ACTIVE
        })
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email', async () => {
      const resendSpy = jest.spyOn(service, 'resendVerification');
      const userWithoutToken = { ...mockUser, resetPasswordExpires: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutToken);

      // Mock generateVerificationToken to not actually set the token
      jest.spyOn(service, 'generateVerificationToken').mockResolvedValue('new-token');

      await service.resendVerificationEmail('user-123');

      expect(resendSpy).toHaveBeenCalledWith('user-123');
    });
  });

  describe('resendVerification', () => {
    beforeEach(() => {
      jest.spyOn(service, 'generateVerificationToken').mockResolvedValue('new-token');
    });

    it('should resend verification for unverified user', async () => {
      const userWithoutToken = { ...mockUser, resetPasswordExpires: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutToken);

      await service.resendVerification('user-123');

      expect(service.generateVerificationToken).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.resendVerification('invalid-id')).rejects.toThrow(
        new NotFoundException('User not found')
      );
    });

    it('should throw BadRequestException if email already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser);

      await expect(service.resendVerification('user-123')).rejects.toThrow(
        new BadRequestException('Email already verified')
      );
    });

    it('should throw BadRequestException if recent verification was sent', async () => {
      const userWithRecentToken = {
        ...mockUser,
        resetPasswordExpires: new Date(Date.now() + 23.5 * 60 * 60 * 1000), // 23.5 hours from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithRecentToken);

      await expect(service.resendVerification('user-123')).rejects.toThrow(
        new BadRequestException(
          'A verification email was recently sent. Please check your email or wait before requesting another.'
        )
      );
    });

    it('should allow resend if previous token is close to expiry', async () => {
      const userWithExpiringToken = {
        ...mockUser,
        resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiringToken);

      await service.resendVerification('user-123');

      expect(service.generateVerificationToken).toHaveBeenCalledWith('user-123');
    });
  });

  describe('isEmailVerified', () => {
    it('should return true for verified user', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser);

      const result = await service.isEmailVerified('user-123');

      expect(result).toBe(true);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: ['emailVerified'],
      });
    });

    it('should return false for unverified user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.isEmailVerified('user-123');

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.isEmailVerified('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('sendVerificationEmail', () => {
    beforeEach(() => {
      jest.spyOn(service, 'generateVerificationToken').mockResolvedValue('token');
    });

    it('should send verification email for unverified user', async () => {
      await service.sendVerificationEmail(mockUser as User);

      expect(service.generateVerificationToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should skip if user is already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };

      await service.sendVerificationEmail(verifiedUser as User);

      expect(service.generateVerificationToken).not.toHaveBeenCalled();
    });
  });
});
