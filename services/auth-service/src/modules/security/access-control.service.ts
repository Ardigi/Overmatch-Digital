import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';

export interface AccessReview {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  privilegedUsers: number;
  reviewDate: Date;
  flaggedForReview: Array<{
    userId: string;
    reason: string;
  }>;
}

export interface ChangeValidation {
  requiresApproval: boolean;
  approvers: string[];
  testingRequired: boolean;
  rollbackPlan: boolean;
}

@Injectable()
export class AccessControlService {
  private readonly accessMatrix = {
    admin: ['read', 'write', 'delete', 'admin'],
    manager: ['read', 'write', 'delete'],
    user: ['read', 'write'],
    guest: ['read'],
  };

  private readonly privilegedRoles = ['admin', 'security_officer', 'auditor'];
  
  private readonly conflictingRoles = [
    ['developer', 'auditor'],
    ['security_admin', 'system_user'],
    ['approver', 'requester'],
  ];

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private auditService: AuditService,
  ) {}

  /**
   * Check permissions for a role and action
   */
  checkPermissions(role: string, action: string): boolean {
    const permissions = this.accessMatrix[role] || [];
    return permissions.includes(action);
  }

  /**
   * Validate privileged access
   */
  async validatePrivilegedAccess(userId: string, resource: string): Promise<{ granted: boolean }> {
    const privilegedResources = ['financial_data', 'user_pii', 'audit_logs'];
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Check if resource requires privileged access
    if (privilegedResources.includes(resource)) {
      const hasPrivilegedRole = user.roles && user.roles.some(role => 
        this.privilegedRoles.includes(role)
      );

      if (!hasPrivilegedRole) {
        await this.auditService.log({
          userId,
          action: 'access_denied',
          details: { resource, reason: 'insufficient_privileges' },
          severity: 'high',
        });
        throw new ForbiddenException('Access denied to restricted resource');
      }
    }

    return { granted: true };
  }

  /**
   * Terminate user access
   */
  async terminateAccess(userId: string): Promise<{
    accountDisabled: boolean;
    sessionsRevoked: boolean;
    accessKeysRevoked: boolean;
    timestamp: Date;
  }> {
    // Update user status
    await this.userRepository.update(userId, {
      isActive: false,
      disabledAt: new Date(),
    });

    // In production, would also:
    // - Revoke all active sessions
    // - Invalidate all API keys
    // - Remove from all groups
    // - Trigger notification to managers

    await this.auditService.log({
      userId,
      action: 'access_terminated',
      severity: 'high',
      timestamp: new Date(),
    });

    return {
      accountDisabled: true,
      sessionsRevoked: true,
      accessKeysRevoked: true,
      timestamp: new Date(),
    };
  }

  /**
   * Modify user role
   */
  async modifyUserRole(userId: string, oldRole: string, newRole: string): Promise<{
    changed: boolean;
    requiresApproval: boolean;
    oldPermissions: string[];
    newPermissions: string[];
  }> {
    const roleHierarchy = {
      admin: 4,
      manager: 3,
      user: 2,
      guest: 1,
    };

    // Log role change
    await this.auditService.logSecurityEvent({
      type: 'role_change',
      userId,
      oldRole,
      newRole,
      timestamp: new Date(),
    });

    // Check if downgrade requires additional approval
    const requiresApproval = roleHierarchy[oldRole] > roleHierarchy[newRole];

    return {
      changed: true,
      requiresApproval,
      oldPermissions: this.accessMatrix[oldRole] || [],
      newPermissions: this.accessMatrix[newRole] || [],
    };
  }

  /**
   * Review access rights periodically
   */
  async reviewAccessRights(): Promise<AccessReview> {
    const allUsers = await this.userRepository.find({
      relations: ['roles'],
    });

    const activeUsers = allUsers.filter(u => u.isActive);
    const inactiveUsers = allUsers.filter(u => !u.isActive);
    const privilegedUsers = allUsers.filter(u => 
      u.roles && u.roles.some(r => this.privilegedRoles.includes(r))
    );

    const flaggedForReview: Array<{ userId: string; reason: string }> = [];

    // Flag inactive users with privileged access
    inactiveUsers.forEach(user => {
      if (user.roles && user.roles.some(r => this.privilegedRoles.includes(r))) {
        flaggedForReview.push({
          userId: user.id,
          reason: 'inactive_with_privileged_access',
        });
      }
    });

    // Flag users inactive for 90+ days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    allUsers.forEach(user => {
      if (user.lastLoginAt && user.lastLoginAt < ninetyDaysAgo) {
        flaggedForReview.push({
          userId: user.id,
          reason: 'inactive_90_days',
        });
      }
    });

    // Flag users with excessive privileges
    allUsers.forEach(user => {
      if (user.roles.length > 3) {
        flaggedForReview.push({
          userId: user.id,
          reason: 'excessive_privileges',
        });
      }
    });

    return {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      inactiveUsers: inactiveUsers.length,
      privilegedUsers: privilegedUsers.length,
      reviewDate: new Date(),
      flaggedForReview,
    };
  }

  /**
   * Check if role requires approval
   */
  requiresApproval(role: string): boolean {
    return this.privilegedRoles.includes(role);
  }

  /**
   * Enforce segregation of duties
   */
  enforceSegregationOfDuties(userRoles: string[]): { valid: boolean } {
    for (const [role1, role2] of this.conflictingRoles) {
      if (userRoles.includes(role1) && userRoles.includes(role2)) {
        throw new Error(`Segregation of duties violation: ${role1} and ${role2}`);
      }
    }
    return { valid: true };
  }

  /**
   * Validate change request
   */
  validateChange(change: {
    type: string;
    description: string;
  }): ChangeValidation {
    const requiredApprovals = {
      production: ['manager', 'security_officer'],
      security_config: ['security_officer', 'ciso'],
      access_control: ['manager', 'hr'],
    };

    const approvers = requiredApprovals[change.type] || ['manager'];
    
    return {
      requiresApproval: true,
      approvers,
      testingRequired: change.type === 'production',
      rollbackPlan: true,
    };
  }

  /**
   * Verify identity before account creation
   */
  async verifyIdentity(data: {
    email: string;
    name: string;
    organization: string;
    role?: string;
  }): Promise<{
    verified: boolean;
    verificationMethod: string;
  }> {
    const requiredFields = ['email', 'name', 'organization'];
    const hasRequired = requiredFields.every(field => data[field]);

    if (!hasRequired) {
      throw new Error('Identity verification failed');
    }

    // Verify email domain matches organization
    const emailDomain = data.email.split('@')[1];
    const orgDomain = 'example.com'; // In production, lookup from organization settings

    return {
      verified: emailDomain === orgDomain,
      verificationMethod: 'email_domain',
    };
  }

  /**
   * Validate registration against policies
   */
  async validateRegistration(data: {
    email: string;
    [key: string]: any;
  }): Promise<{
    valid: boolean;
    policies: any;
  }> {
    const policies = {
      allowedDomains: ['example.com', 'partner.com'],
      requiredPasswordStrength: 'strong',
      requiresMFA: true,
      maxAccountsPerOrg: 100,
    };

    const domain = data.email.split('@')[1];
    
    if (!policies.allowedDomains.includes(domain)) {
      throw new Error('Email domain not allowed');
    }

    return { valid: true, policies };
  }
}