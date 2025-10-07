import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Organization } from '../users/entities/organization.entity';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  preventReuse: number;
  maxAge: number; // days
  minAge: number; // hours
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  enablePasswordHistory?: boolean;
  passwordHistoryCount?: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number; // 0-100
}

@Injectable()
export class PasswordPolicyService {
  private defaultPolicy: PasswordPolicy;
  private commonPasswords: Set<string>;

  constructor(private configService: ConfigService) {
    this.defaultPolicy = {
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

    // Load common passwords list (top 1000 most common)
    this.commonPasswords = new Set([
      'password',
      '123456',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      '1234567890',
      'qwerty',
      'abc123',
      'Password1',
      'password1',
      '123456789',
      'welcome123',
      'admin123',
      'root',
      'toor',
      'pass',
      'test',
      'guest',
      // Add more common passwords in production
    ]);
  }

  /**
   * Get default password policy
   */
  getDefaultPolicy(): PasswordPolicy {
    return this.defaultPolicy;
  }

  /**
   * Get password policy for an organization
   */
  getPolicy(organization?: Organization): PasswordPolicy {
    if (!organization || !organization.passwordPolicy) {
      return this.defaultPolicy;
    }

    return {
      ...this.defaultPolicy,
      ...organization.passwordPolicy,
    };
  }

  /**
   * Validate password against policy
   */
  async validatePassword(
    password: string,
    policy?: PasswordPolicy,
    userInfo?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      previousPasswords?: string[];
    }
  ): Promise<PasswordValidationResult> {
    // Use default policy if none provided
    if (!policy) {
      policy = this.getDefaultPolicy();
    }
    const errors: string[] = [];
    let score = 100;

    // Check minimum length
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
      score -= 20;
    }

    // Check uppercase requirement
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
      score -= 15;
    }

    // Check lowercase requirement
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
      score -= 15;
    }

    // Check number requirement
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
      score -= 15;
    }

    // Check special character requirement
    if (policy.requireSpecialChars) {
      const specialCharsRegex = new RegExp(
        `[${policy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
      );
      if (!specialCharsRegex.test(password)) {
        errors.push(
          `Password must contain at least one special character (${policy.specialChars})`
        );
        score -= 15;
      }
    }

    // Check common passwords
    if (policy.preventCommonPasswords && this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
      score -= 30;
    }

    // Check against user information
    if (policy.preventUserInfo && userInfo) {
      if (this.containsUserInfo(password, userInfo)) {
        errors.push('Password must not contain your personal information');
        score -= 25;
      }
    }

    // Check password reuse
    if (policy.preventReuse > 0 && userInfo?.previousPasswords) {
      const bcrypt = await import('bcrypt');
      for (const oldPassword of userInfo.previousPasswords.slice(0, policy.preventReuse)) {
        if (await bcrypt.compare(password, oldPassword)) {
          errors.push(`Password must not be one of your last ${policy.preventReuse} passwords`);
          score -= 30;
          break;
        }
      }
    }

    // Additional strength checks
    score += this.calculateStrengthBonus(password);
    score = Math.max(0, Math.min(100, score));

    return {
      isValid: errors.length === 0,
      errors,
      score,
    };
  }

  /**
   * Generate a strong password
   */
  generatePassword(policy: PasswordPolicy): string {
    const length = Math.max(policy.minLength, 12);
    const chars = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: policy.specialChars,
    };

    let password = '';
    let charSet = '';

    // Build character set and ensure requirements
    if (policy.requireUppercase) {
      password += this.getRandomChar(chars.uppercase);
      charSet += chars.uppercase;
    }
    if (policy.requireLowercase) {
      password += this.getRandomChar(chars.lowercase);
      charSet += chars.lowercase;
    }
    if (policy.requireNumbers) {
      password += this.getRandomChar(chars.numbers);
      charSet += chars.numbers;
    }
    if (policy.requireSpecialChars) {
      password += this.getRandomChar(chars.special);
      charSet += chars.special;
    }

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charSet);
    }

    // Shuffle password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Check if password needs to be changed
   */
  isPasswordExpired(passwordChangedAt: Date, policy: PasswordPolicy): boolean {
    if (!policy.maxAge || policy.maxAge <= 0) {
      return false;
    }

    const daysSinceChange = Math.floor(
      (Date.now() - passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceChange > policy.maxAge;
  }

  /**
   * Check if password can be changed (minimum age)
   */
  canChangePassword(passwordChangedAt: Date, policy: PasswordPolicy): boolean {
    if (!policy.minAge || policy.minAge <= 0) {
      return true;
    }

    const hoursSinceChange = Math.floor(
      (Date.now() - passwordChangedAt.getTime()) / (1000 * 60 * 60)
    );

    return hoursSinceChange >= policy.minAge;
  }

  /**
   * Validate password change
   */
  async validatePasswordChange(
    currentPassword: string,
    newPassword: string,
    policy: PasswordPolicy,
    userInfo?: any
  ): Promise<PasswordValidationResult> {
    // First validate the new password
    const result = await this.validatePassword(newPassword, policy, userInfo);

    // Check if new password is too similar to current
    if (this.areSimilar(currentPassword, newPassword)) {
      result.errors.push('New password is too similar to current password');
      result.score -= 20;
      result.isValid = false;
    }

    result.score = Math.max(0, Math.min(100, result.score));
    return result;
  }

  private isCommonPassword(password: string): boolean {
    return this.commonPasswords.has(password.toLowerCase());
  }

  private containsUserInfo(password: string, userInfo: any): boolean {
    const lowerPassword = password.toLowerCase();

    if (userInfo.email && lowerPassword.includes(userInfo.email.split('@')[0].toLowerCase())) {
      return true;
    }

    if (userInfo.firstName && lowerPassword.includes(userInfo.firstName.toLowerCase())) {
      return true;
    }

    if (userInfo.lastName && lowerPassword.includes(userInfo.lastName.toLowerCase())) {
      return true;
    }

    return false;
  }

  private calculateStrengthBonus(password: string): number {
    let bonus = 0;

    // Length bonus
    if (password.length > 12) bonus += 5;
    if (password.length > 16) bonus += 5;

    // Character variety bonus
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const varieties = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    bonus += varieties * 5;

    // Pattern penalty
    if (/(.)\1{2,}/.test(password)) bonus -= 10; // Repeated characters
    if (/^[A-Za-z]+\d+$/.test(password)) bonus -= 10; // Common pattern like "password123"
    if (/^\d+[A-Za-z]+$/.test(password)) bonus -= 10; // Common pattern like "123password"

    return bonus;
  }

  private areSimilar(password1: string, password2: string): boolean {
    // Check if passwords are too similar using Levenshtein distance
    const distance = this.levenshteinDistance(password1, password2);
    const maxLength = Math.max(password1.length, password2.length);
    const similarity = 1 - distance / maxLength;

    return similarity > 0.8; // 80% similar
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getRandomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }
}
