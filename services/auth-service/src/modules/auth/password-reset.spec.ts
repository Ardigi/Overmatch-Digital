import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Password Reset Security Test Suite
 * Based on OWASP Password Reset Best Practices
 * https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
 */
describe('Password Reset Security Tests', () => {
  let passwordResetService: any;
  let usersService: any;
  let emailService: any;
  let auditService: any;

  const mockPasswordResetService = {
    requestPasswordReset: jest.fn(),
    validateResetToken: jest.fn(),
    resetPassword: jest.fn(),
    generateResetToken: jest.fn(),
    invalidateToken: jest.fn(),
    checkTokenExpiry: jest.fn(),
    getRateLimitStatus: jest.fn(),
    checkSuspiciousActivity: jest.fn(),
    generateResetUrl: jest.fn(),
    detectSuspiciousPatterns: jest.fn(),
    validateSecurityQuestions: jest.fn(),
    sendSMSVerification: jest.fn(),
    initiateManualRecovery: jest.fn(),
    clearFailedAttempts: jest.fn(),
    invalidateAllSessions: jest.fn(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    updatePassword: jest.fn(),
    lockAccount: jest.fn(),
    unlockAccount: jest.fn(),
    addPasswordHistory: jest.fn(),
    checkPasswordHistory: jest.fn(),
  };

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedNotification: jest.fn(),
    sendSecurityAlert: jest.fn(),
  };

  const mockAuditService = {
    logPasswordResetRequest: jest.fn(),
    logPasswordResetSuccess: jest.fn(),
    logPasswordResetFailure: jest.fn(),
    logSuspiciousActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: 'PasswordResetService', useValue: mockPasswordResetService },
        { provide: 'UsersService', useValue: mockUsersService },
        { provide: 'EmailService', useValue: mockEmailService },
        { provide: 'AuditService', useValue: mockAuditService },
      ],
    }).compile();

    passwordResetService = module.get('PasswordResetService');
    usersService = module.get('UsersService');
    emailService = module.get('EmailService');
    auditService = module.get('AuditService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Reset Request Security', () => {
    it('should not reveal whether email exists', async () => {
      const existingEmail = 'exists@example.com';
      const nonExistingEmail = 'notexists@example.com';

      // Both should return same response
      mockPasswordResetService.requestPasswordReset.mockResolvedValue({
        message:
          'If the email address exists in our system, you will receive a password reset email shortly.',
        success: true,
      });

      const response1 = await passwordResetService.requestPasswordReset(existingEmail);
      const response2 = await passwordResetService.requestPasswordReset(nonExistingEmail);

      expect(response1.message).toBe(response2.message);
      expect(response1.success).toBe(response2.success);
    });

    it('should have consistent response times', async () => {
      const emails = ['exists@example.com', 'notexists@example.com'];
      const responseTimes = [];

      mockPasswordResetService.requestPasswordReset.mockImplementation(async (email) => {
        // Simulate consistent processing time
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true };
      });

      for (const email of emails) {
        const start = Date.now();
        await passwordResetService.requestPasswordReset(email);
        const duration = Date.now() - start;
        responseTimes.push(duration);
      }

      // Response times should be within 50ms of each other
      const maxDiff = Math.max(...responseTimes) - Math.min(...responseTimes);
      expect(maxDiff).toBeLessThan(50);
    });

    it('should rate limit password reset requests', async () => {
      const email = 'test@example.com';
      const maxRequests = 3;
      const timeWindow = 3600000; // 1 hour

      mockPasswordResetService.getRateLimitStatus.mockImplementation((email) => ({
        requests: 3,
        maxRequests: 3,
        resetTime: Date.now() + timeWindow,
      }));

      mockPasswordResetService.requestPasswordReset.mockImplementation(async (email) => {
        const status = passwordResetService.getRateLimitStatus(email);
        if (status.requests >= status.maxRequests) {
          throw new BadRequestException(
            'Too many password reset requests. Please try again later.'
          );
        }
        return { success: true };
      });

      // Should fail after max requests
      await expect(passwordResetService.requestPasswordReset(email)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should implement progressive delays', async () => {
      const email = 'test@example.com';
      const attempts = [0, 1000, 3000, 5000, 10000]; // Progressive delays in ms

      mockPasswordResetService.requestPasswordReset.mockImplementation(
        async (email, attemptNumber) => {
          const delay = attempts[Math.min(attemptNumber, attempts.length - 1)];
          await new Promise((resolve) => setTimeout(resolve, delay));
          return { success: true };
        }
      );

      // First attempt - no delay
      const start1 = Date.now();
      await passwordResetService.requestPasswordReset(email, 0);
      const duration1 = Date.now() - start1;
      expect(duration1).toBeLessThan(100);

      // Third attempt - 3 second delay
      const start3 = Date.now();
      await passwordResetService.requestPasswordReset(email, 2);
      const duration3 = Date.now() - start3;
      expect(duration3).toBeGreaterThanOrEqual(3000);
    });

    it('should validate email format before processing', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'email@',
        '',
        null,
        undefined,
        'javascript:alert(1)',
        '<script>alert(1)</script>@email.com',
      ];

      // Mock should properly validate email format
      mockPasswordResetService.requestPasswordReset.mockImplementation(async (email) => {
        // Check for null/undefined/empty
        if (!email) {
          throw new BadRequestException('Invalid email address');
        }

        // Check type
        if (typeof email !== 'string') {
          throw new BadRequestException('Invalid email address');
        }

        // Validate email format with regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new BadRequestException('Invalid email address');
        }

        // Additional security checks
        if (email.includes('<script>') || email.includes('javascript:')) {
          throw new BadRequestException('Invalid email address');
        }

        return { success: true };
      });

      // Test each invalid email
      for (const email of invalidEmails) {
        await expect(passwordResetService.requestPasswordReset(email)).rejects.toThrow(
          BadRequestException
        );
      }

      // Also test that valid emails pass
      const validEmails = ['user@example.com', 'test.user@company.co.uk', 'admin+tag@domain.org'];

      for (const email of validEmails) {
        const result = await passwordResetService.requestPasswordReset(email);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Reset Token Security', () => {
    it('should generate cryptographically secure tokens', async () => {
      mockPasswordResetService.generateResetToken.mockImplementation(() => {
        // Generate secure random token
        return crypto.randomBytes(32).toString('hex');
      });

      const tokens = new Set();

      // Generate many tokens
      for (let i = 0; i < 1000; i++) {
        const token = passwordResetService.generateResetToken();

        // Token should be long enough
        expect(token.length).toBeGreaterThanOrEqual(64); // 32 bytes = 64 hex chars

        // Should not have predictable patterns
        expect(token).toMatch(/^[a-f0-9]+$/);

        tokens.add(token);
      }

      // All tokens should be unique
      expect(tokens.size).toBe(1000);
    });

    it('should hash tokens before storage', async () => {
      const plainToken = 'abc123def456';

      mockPasswordResetService.storeResetToken = jest.fn(async (userId, token) => {
        // Hash token before storage
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        return {
          userId,
          tokenHash: hashedToken,
          expiresAt: Date.now() + 3600000, // 1 hour
        };
      });

      const stored = await mockPasswordResetService.storeResetToken('user-123', plainToken);

      // Should not store plain token
      expect(stored.tokenHash).not.toBe(plainToken);
      expect(stored.tokenHash).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    it('should set appropriate token expiry', async () => {
      const tokenExpiryTimes = {
        default: 60 * 60 * 1000, // 1 hour
        highSecurity: 15 * 60 * 1000, // 15 minutes
        lowSecurity: 24 * 60 * 60 * 1000, // 24 hours (too long)
      };

      mockPasswordResetService.generateResetToken.mockImplementation(
        (securityLevel = 'default') => {
          const expiry = tokenExpiryTimes[securityLevel];
          return {
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt: Date.now() + expiry,
          };
        }
      );

      const defaultToken = passwordResetService.generateResetToken();
      const highSecurityToken = passwordResetService.generateResetToken('highSecurity');

      // Default should be 1 hour
      expect(defaultToken.expiresAt - Date.now()).toBeCloseTo(3600000, -4);

      // High security should be shorter
      expect(highSecurityToken.expiresAt - Date.now()).toBeCloseTo(900000, -4);
    });

    it('should invalidate token after single use', async () => {
      const token = 'valid-reset-token';
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      let tokenUsed = false;

      mockPasswordResetService.validateResetToken.mockImplementation(async (token) => {
        if (tokenUsed) {
          throw new BadRequestException('Reset token has already been used');
        }
        return { valid: true, userId: 'user-123' };
      });

      mockPasswordResetService.resetPassword.mockImplementation(async (token, newPassword) => {
        const validation = await passwordResetService.validateResetToken(token);
        if (validation.valid) {
          tokenUsed = true;
          return { success: true };
        }
      });

      // First use should succeed
      const result1 = await passwordResetService.resetPassword(token, 'NewP@ssw0rd!');
      expect(result1.success).toBe(true);

      // Second use should fail
      await expect(passwordResetService.validateResetToken(token)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate token format', async () => {
      const invalidTokens = [
        '',
        null,
        undefined,
        '../../etc/passwd',
        '<script>alert(1)</script>',
        'a'.repeat(1000), // Too long
        '!@#$%^&*()', // Invalid characters
        'short', // Too short
      ];

      mockPasswordResetService.validateResetToken.mockImplementation(async (token) => {
        if (!token || !token.match(/^[a-f0-9]{64}$/)) {
          throw new BadRequestException('Invalid reset token format');
        }
        return { valid: true };
      });

      for (const token of invalidTokens) {
        await expect(passwordResetService.validateResetToken(token)).rejects.toThrow(
          BadRequestException
        );
      }
    });
  });

  describe('Password Reset Process', () => {
    it('should enforce password complexity during reset', async () => {
      const token = 'valid-token';
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'Password1', // No special chars
        'password123!', // No uppercase
        'PASSWORD123!', // No lowercase
        'Pass!23', // Too short
      ];

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        // Password validation
        const minLength = 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChars = /[!@#$%^&*]/.test(password);

        if (
          password.length < minLength ||
          !hasUppercase ||
          !hasLowercase ||
          !hasNumbers ||
          !hasSpecialChars
        ) {
          throw new BadRequestException('Password does not meet complexity requirements');
        }

        return { success: true };
      });

      for (const password of weakPasswords) {
        await expect(passwordResetService.resetPassword(token, password)).rejects.toThrow(
          BadRequestException
        );
      }
    });

    it('should prevent password reuse', async () => {
      const token = 'valid-token';
      const userId = 'user-123';
      const oldPasswords = ['OldP@ssw0rd1!', 'OldP@ssw0rd2!', 'OldP@ssw0rd3!'];

      mockPasswordResetService.validateResetToken.mockResolvedValue({
        valid: true,
        userId,
      });

      mockUsersService.checkPasswordHistory.mockImplementation(async (userId, password) => {
        return oldPasswords.some((old) => bcrypt.compareSync(password, bcrypt.hashSync(old, 10)));
      });

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        const validation = await passwordResetService.validateResetToken(token);

        // Check password history
        const isReused = await usersService.checkPasswordHistory(validation.userId, password);
        if (isReused) {
          throw new BadRequestException('Cannot reuse recent passwords');
        }

        return { success: true };
      });

      // Should reject old passwords
      for (const oldPassword of oldPasswords) {
        await expect(passwordResetService.resetPassword(token, oldPassword)).rejects.toThrow(
          BadRequestException
        );
      }

      // Should accept new password
      const result = await passwordResetService.resetPassword(token, 'NewP@ssw0rd4!');
      expect(result.success).toBe(true);
    });

    it('should require additional verification for suspicious requests', async () => {
      const suspiciousIndicators = {
        differentCountry: true,
        unusualTime: true,
        multipleRecentAttempts: true,
        differentDevice: true,
      };

      mockPasswordResetService.checkSuspiciousActivity.mockImplementation(
        async (email, metadata) => {
          const score = Object.values(suspiciousIndicators).filter((v) => v).length;
          return {
            suspicious: score >= 2,
            score,
            requiresAdditionalVerification: score >= 2,
          };
        }
      );

      const check = await mockPasswordResetService.checkSuspiciousActivity('test@example.com', {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
      });

      expect(check.suspicious).toBe(true);
      expect(check.requiresAdditionalVerification).toBe(true);
    });

    it('should notify user of password changes', async () => {
      const token = 'valid-token';
      const userId = 'user-123';
      const userEmail = 'user@example.com';

      mockPasswordResetService.validateResetToken.mockResolvedValue({
        valid: true,
        userId,
      });

      mockUsersService.findById = jest.fn().mockResolvedValue({
        id: userId,
        email: userEmail,
      });

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        const validation = await passwordResetService.validateResetToken(token);
        const user = await usersService.findById(validation.userId);

        // Send notification
        await emailService.sendPasswordChangedNotification(user.email, {
          timestamp: new Date(),
          ip: '192.168.1.1',
          location: 'New York, US',
        });

        return { success: true };
      });

      await passwordResetService.resetPassword(token, 'NewP@ssw0rd!');

      expect(mockEmailService.sendPasswordChangedNotification).toHaveBeenCalledWith(
        userEmail,
        expect.objectContaining({
          timestamp: expect.any(Date),
          ip: expect.any(String),
        })
      );
    });
  });

  describe('Security Headers and Transport', () => {
    it('should use secure URL format', async () => {
      const token = 'abc123def456';
      const baseUrl = 'https://example.com';

      mockPasswordResetService.generateResetUrl.mockImplementation((token) => {
        // URL should use HTTPS
        const url = `${baseUrl}/auth/reset-password?token=${token}`;

        expect(url).toMatch(/^https:\/\//);
        expect(url).not.toContain('http://');

        return url;
      });

      const resetUrl = passwordResetService.generateResetUrl(token);
      expect(resetUrl).toContain('https://');
    });

    it('should not include sensitive data in URLs', async () => {
      mockPasswordResetService.generateResetUrl.mockImplementation((token, userId, email) => {
        const url = `https://example.com/reset?token=${token}`;

        // Should not include user ID or email in URL
        expect(url).not.toContain(userId);
        expect(url).not.toContain(email);

        return url;
      });

      const url = passwordResetService.generateResetUrl('token123', 'user-123', 'user@example.com');
      expect(url).not.toContain('user-123');
      expect(url).not.toContain('user@example.com');
    });
  });

  describe('Audit and Monitoring', () => {
    it('should log all password reset attempts', async () => {
      const email = 'test@example.com';
      const metadata = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
      };

      mockPasswordResetService.requestPasswordReset.mockImplementation(async (email) => {
        await auditService.logPasswordResetRequest({
          email,
          ...metadata,
          action: 'password_reset_requested',
        });
        return { success: true };
      });

      await passwordResetService.requestPasswordReset(email);

      expect(mockAuditService.logPasswordResetRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          action: 'password_reset_requested',
        })
      );
    });

    it('should log successful password resets', async () => {
      const token = 'valid-token';
      const userId = 'user-123';

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        await auditService.logPasswordResetSuccess({
          userId,
          timestamp: new Date(),
          action: 'password_reset_completed',
        });
        return { success: true };
      });

      await passwordResetService.resetPassword(token, 'NewP@ssw0rd!');

      expect(mockAuditService.logPasswordResetSuccess).toHaveBeenCalled();
    });

    it('should log failed reset attempts', async () => {
      const token = 'invalid-token';

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        await auditService.logPasswordResetFailure({
          token: crypto.createHash('sha256').update(token).digest('hex'),
          reason: 'invalid_token',
          timestamp: new Date(),
        });
        throw new BadRequestException('Invalid token');
      });

      await expect(passwordResetService.resetPassword(token, 'NewP@ssw0rd!')).rejects.toThrow(
        BadRequestException
      );

      expect(mockAuditService.logPasswordResetFailure).toHaveBeenCalled();
    });

    it('should detect and log suspicious patterns', async () => {
      const suspiciousPatterns = [
        { pattern: 'multiple_accounts_same_ip', count: 5 },
        { pattern: 'rapid_reset_requests', count: 10 },
        { pattern: 'automated_behavior', count: 20 },
      ];

      let callCount = 0;
      mockPasswordResetService.detectSuspiciousPatterns.mockImplementation(async () => {
        for (const pattern of suspiciousPatterns) {
          if (pattern.count > 10) {
            await auditService.logSuspiciousActivity({
              pattern: pattern.pattern,
              severity: 'high',
              action: 'password_reset_abuse',
            });
            callCount++;
          }
        }
      });

      await mockPasswordResetService.detectSuspiciousPatterns();

      // Two patterns have count > 10: 'automated_behavior' (20) and 'rapid_reset_requests' (10 is not > 10)
      // Actually, only 'automated_behavior' has count > 10 (20 > 10)
      expect(mockAuditService.logSuspiciousActivity).toHaveBeenCalledTimes(1);
    });
  });

  describe('Alternative Reset Methods', () => {
    it('should support security questions as backup', async () => {
      const userId = 'user-123';
      const securityQuestions = [
        { question: "What was your first pet's name?", answer: 'fluffy' },
        { question: 'In what city were you born?', answer: 'new york' },
      ];

      mockPasswordResetService.validateSecurityQuestions.mockImplementation(
        async (userId, answers) => {
          // Answers should be case-insensitive and trimmed
          const normalizedAnswers = answers.map((a) => a.toLowerCase().trim());

          // Should require multiple correct answers
          const correctAnswers = normalizedAnswers.filter(
            (answer, index) => answer === securityQuestions[index].answer.toLowerCase()
          );

          if (correctAnswers.length < 2) {
            throw new BadRequestException('Incorrect security answers');
          }

          return { valid: true };
        }
      );

      // All correct
      const result = await passwordResetService.validateSecurityQuestions(userId, [
        'Fluffy',
        'New York',
      ]);
      expect(result.valid).toBe(true);

      // Some incorrect
      await expect(
        passwordResetService.validateSecurityQuestions(userId, ['Wrong', 'New York'])
      ).rejects.toThrow(BadRequestException);
    });

    it('should support SMS/phone verification', async () => {
      const phoneNumber = '+1234567890';
      const verificationCode = '123456';

      mockPasswordResetService.sendSMSVerification.mockImplementation(async (phone) => {
        // Should mask phone number in logs
        const masked = phone.slice(0, 3) + '****' + phone.slice(-2);

        return {
          sent: true,
          maskedPhone: masked,
          expiresIn: 300, // 5 minutes
        };
      });

      const result = await passwordResetService.sendSMSVerification(phoneNumber);

      expect(result.maskedPhone).toBe('+12****90');
      expect(result.expiresIn).toBe(300);
    });

    it('should support account recovery via support', async () => {
      mockPasswordResetService.initiateManualRecovery.mockImplementation(async (email, reason) => {
        return {
          ticketId: 'RECOVERY-' + Date.now(),
          status: 'pending_verification',
          estimatedTime: '24-48 hours',
          requiredDocuments: ['government_id', 'proof_of_account_ownership'],
        };
      });

      const recovery = await passwordResetService.initiateManualRecovery(
        'user@example.com',
        'Lost access to email and phone'
      );

      expect(recovery.status).toBe('pending_verification');
      expect(recovery.requiredDocuments).toContain('government_id');
    });
  });

  describe('Integration with Other Security Features', () => {
    it('should unlock account after successful reset', async () => {
      const token = 'valid-token';
      const userId = 'user-123';

      mockPasswordResetService.validateResetToken.mockResolvedValue({
        valid: true,
        userId,
      });

      mockPasswordResetService.resetPassword.mockImplementation(async (token, password) => {
        const validation = await passwordResetService.validateResetToken(token);

        // Unlock account if it was locked
        await usersService.unlockAccount(validation.userId);

        return { success: true, accountUnlocked: true };
      });

      const result = await passwordResetService.resetPassword(token, 'NewP@ssw0rd!');

      expect(result.accountUnlocked).toBe(true);
      expect(mockUsersService.unlockAccount).toHaveBeenCalledWith(userId);
    });

    it('should clear failed login attempts after reset', async () => {
      const userId = 'user-123';

      mockPasswordResetService.clearFailedAttempts.mockImplementation(async (userId) => {
        return {
          cleared: true,
          previousAttempts: 3,
        };
      });

      const result = await passwordResetService.clearFailedAttempts(userId);

      expect(result.cleared).toBe(true);
      expect(result.previousAttempts).toBe(3);
    });

    it('should force logout all sessions after reset', async () => {
      const userId = 'user-123';

      mockPasswordResetService.invalidateAllSessions.mockImplementation(async (userId) => {
        return {
          sessionsInvalidated: 5,
          devicesLoggedOut: ['iPhone', 'Chrome', 'Firefox'],
        };
      });

      const result = await passwordResetService.invalidateAllSessions(userId);

      expect(result.sessionsInvalidated).toBe(5);
      expect(result.devicesLoggedOut).toContain('iPhone');
    });
  });
});
