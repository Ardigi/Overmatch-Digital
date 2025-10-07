import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Control } from '../../modules/compliance/entities/control.entity';
import { ComplianceFramework } from '../../modules/compliance/entities/framework.entity';
import { Policy } from '../../modules/policies/entities/policy.entity';
import { Risk } from '../../modules/risks/entities/risk.entity';

export interface UserContext {
  id: string;
  organizationId: string;
  roles: string[];
  permissions?: string[];
}

export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  PUBLISH = 'publish',
  EVALUATE = 'evaluate',
  ARCHIVE = 'archive',
}

export enum Resource {
  POLICY = 'policy',
  CONTROL = 'control',
  RISK = 'risk',
  FRAMEWORK = 'framework',
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Control)
    private readonly controlRepository: Repository<Control>,
    @InjectRepository(Risk)
    private readonly riskRepository: Repository<Risk>,
    @InjectRepository(ComplianceFramework)
    private readonly frameworkRepository: Repository<ComplianceFramework>,
  ) {}

  /**
   * Check if user can perform action on resource type
   */
  async canPerformAction(
    user: UserContext,
    action: Action,
    resource: Resource,
    resourceId?: string,
  ): Promise<boolean> {
    // Super admin can do anything
    if (this.hasRole(user, 'admin')) {
      return true;
    }

    // Check resource-specific permissions
    switch (resource) {
      case Resource.POLICY:
        return this.checkPolicyPermission(user, action, resourceId);
      case Resource.CONTROL:
        return this.checkControlPermission(user, action, resourceId);
      case Resource.RISK:
        return this.checkRiskPermission(user, action, resourceId);
      case Resource.FRAMEWORK:
        return this.checkFrameworkPermission(user, action, resourceId);
      default:
        return false;
    }
  }

  /**
   * Ensure user can perform action, throw if not
   */
  async ensureCanPerformAction(
    user: UserContext,
    action: Action,
    resource: Resource,
    resourceId?: string,
  ): Promise<void> {
    const canPerform = await this.canPerformAction(user, action, resource, resourceId);
    
    if (!canPerform) {
      throw new ForbiddenException(
        `User ${user.id} cannot perform ${action} on ${resource}${resourceId ? ` ${resourceId}` : ''}`
      );
    }
  }

  /**
   * Check if user belongs to organization
   */
  async checkOrganizationAccess(
    user: UserContext,
    organizationId: string,
  ): Promise<boolean> {
    // Admin can access any organization
    if (this.hasRole(user, 'admin')) {
      return true;
    }

    // Users can only access their own organization
    return user.organizationId === organizationId;
  }

  /**
   * Filter query by organization access
   */
  applyOrganizationFilter<T>(
    queryBuilder: any,
    user: UserContext,
    alias: string,
  ): void {
    if (!this.hasRole(user, 'admin')) {
      queryBuilder.andWhere(`${alias}.organizationId = :orgId`, {
        orgId: user.organizationId,
      });
    }
  }

  /**
   * Check if user is resource owner
   */
  async isResourceOwner(
    user: UserContext,
    resource: Resource,
    resourceId: string,
  ): Promise<boolean> {
    try {
      switch (resource) {
        case Resource.POLICY: {
          const policy = await this.policyRepository.findOne({
            where: { id: resourceId },
            select: ['ownerId'],
          });
          return policy?.ownerId === user.id || false;
        }

        case Resource.CONTROL: {
          const control = await this.controlRepository.findOne({
            where: { id: resourceId },
            select: ['ownerId'],
          });
          return control?.ownerId === user.id || false;
        }

        case Resource.RISK: {
          const risk = await this.riskRepository.findOne({
            where: { id: resourceId },
            select: ['ownerId'],
          });
          return risk?.ownerId === user.id || false;
        }

        case Resource.FRAMEWORK: {
          const framework = await this.frameworkRepository.findOne({
            where: { id: resourceId },
            select: ['ownerId', 'organizationId'], // Some frameworks might not have ownerId
          });
          // For frameworks, check both ownerId and organization access
          if (framework?.ownerId) {
            return framework.ownerId === user.id;
          }
          // Fallback to organization access if no owner
          return framework && await this.checkOrganizationAccess(user, framework.organizationId);
        }

        default:
          return false;
      }
    } catch (error) {
      // Log error but don't throw - return false for security
      this.logger.error(`Error checking resource ownership for ${resource}:${resourceId}:`, error);
      return false;
    }
  }

  /**
   * Get accessible organization IDs for user
   */
  getAccessibleOrganizations(user: UserContext): string[] {
    if (this.hasRole(user, 'admin')) {
      return []; // Empty array means all organizations
    }
    return [user.organizationId];
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(user: UserContext, permission: string): boolean {
    return user.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has specific role
   */
  hasRole(user: UserContext, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(user: UserContext, roles: string[]): boolean {
    return roles.some(role => this.hasRole(user, role));
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(user: UserContext, roles: string[]): boolean {
    return roles.every(role => this.hasRole(user, role));
  }

  // Resource-specific permission checks

  private async checkPolicyPermission(
    user: UserContext,
    action: Action,
    policyId?: string,
  ): Promise<boolean> {
    // Role-based checks
    switch (action) {
      case Action.CREATE:
        return this.hasAnyRole(user, ['policy_manager', 'compliance_manager']);

      case Action.READ:
        if (this.hasAnyRole(user, ['policy_manager', 'compliance_manager', 'auditor', 'policy_viewer'])) {
          // Check organization access if policy ID provided
          if (policyId) {
            const policy = await this.policyRepository.findOne({
              where: { id: policyId },
              select: ['organizationId'],
            });
            return policy ? await this.checkOrganizationAccess(user, policy.organizationId) : false;
          }
          return true;
        }
        return false;

      case Action.UPDATE:
        if (this.hasAnyRole(user, ['policy_manager', 'compliance_manager'])) {
          if (policyId) {
            const policy = await this.policyRepository.findOne({
              where: { id: policyId },
              select: ['organizationId', 'ownerId'],
            });
            if (!policy) return false;
            
            // Must be in same org
            const hasOrgAccess = await this.checkOrganizationAccess(user, policy.organizationId);
            if (!hasOrgAccess) return false;
            
            // Policy managers can edit any policy in their org
            if (this.hasRole(user, 'policy_manager')) return true;
            
            // Compliance managers can only edit policies they own (if ownerId exists)
            return policy.ownerId ? policy.ownerId === user.id : hasOrgAccess;
          }
          return true;
        }
        return false;

      case Action.DELETE:
      case Action.ARCHIVE:
        return this.hasRole(user, 'policy_manager');

      case Action.APPROVE:
        return this.hasAnyRole(user, ['policy_manager', 'compliance_manager']);

      case Action.PUBLISH:
        return this.hasRole(user, 'policy_manager');

      case Action.EVALUATE:
        return this.hasAnyRole(user, ['policy_manager', 'compliance_manager', 'auditor']);

      default:
        return false;
    }
  }

  private async checkControlPermission(
    user: UserContext,
    action: Action,
    controlId?: string,
  ): Promise<boolean> {
    switch (action) {
      case Action.CREATE:
        return this.hasAnyRole(user, ['compliance_manager', 'control_owner']);

      case Action.READ:
        if (this.hasAnyRole(user, ['compliance_manager', 'control_owner', 'auditor', 'compliance_viewer'])) {
          if (controlId) {
            const control = await this.controlRepository.findOne({
              where: { id: controlId },
              select: ['organizationId'],
            });
            return control ? await this.checkOrganizationAccess(user, control.organizationId) : false;
          }
          return true;
        }
        return false;

      case Action.UPDATE:
        if (this.hasAnyRole(user, ['compliance_manager', 'control_owner'])) {
          if (controlId) {
            const control = await this.controlRepository.findOne({
              where: { id: controlId },
              select: ['organizationId', 'ownerId'],
            });
            if (!control) return false;
            
            const hasOrgAccess = await this.checkOrganizationAccess(user, control.organizationId);
            if (!hasOrgAccess) return false;
            
            // Compliance managers can edit any control
            if (this.hasRole(user, 'compliance_manager')) return true;
            
            // Control owners can only edit their own controls (if ownerId exists)
            return control.ownerId ? control.ownerId === user.id : hasOrgAccess;
          }
          return true;
        }
        return false;

      case Action.DELETE:
      case Action.ARCHIVE:
        return this.hasRole(user, 'compliance_manager');

      default:
        return false;
    }
  }

  private async checkRiskPermission(
    user: UserContext,
    action: Action,
    riskId?: string,
  ): Promise<boolean> {
    switch (action) {
      case Action.CREATE:
        return this.hasAnyRole(user, ['risk_manager', 'compliance_manager']);

      case Action.READ:
        if (this.hasAnyRole(user, ['risk_manager', 'compliance_manager', 'auditor', 'risk_viewer'])) {
          if (riskId) {
            const risk = await this.riskRepository.findOne({
              where: { id: riskId },
              select: ['organizationId'],
            });
            return risk ? await this.checkOrganizationAccess(user, risk.organizationId) : false;
          }
          return true;
        }
        return false;

      case Action.UPDATE:
        if (this.hasAnyRole(user, ['risk_manager', 'compliance_manager'])) {
          if (riskId) {
            const risk = await this.riskRepository.findOne({
              where: { id: riskId },
              select: ['organizationId', 'ownerId'],
            });
            if (!risk) return false;
            
            const hasOrgAccess = await this.checkOrganizationAccess(user, risk.organizationId);
            if (!hasOrgAccess) return false;
            
            // Risk managers can edit any risk
            if (this.hasRole(user, 'risk_manager')) return true;
            
            // Others can only edit risks they own (if ownerId exists)
            return risk.ownerId ? risk.ownerId === user.id : hasOrgAccess;
          }
          return true;
        }
        return false;

      case Action.DELETE:
      case Action.ARCHIVE:
        return this.hasRole(user, 'risk_manager');

      default:
        return false;
    }
  }

  private async checkFrameworkPermission(
    user: UserContext,
    action: Action,
    frameworkId?: string,
  ): Promise<boolean> {
    switch (action) {
      case Action.CREATE:
      case Action.UPDATE:
      case Action.DELETE:
        // Only compliance managers can manage frameworks
        return this.hasRole(user, 'compliance_manager');

      case Action.READ:
        if (this.hasAnyRole(user, ['compliance_manager', 'auditor', 'framework_viewer'])) {
          if (frameworkId) {
            const framework = await this.frameworkRepository.findOne({
              where: { id: frameworkId },
              select: ['organizationId'],
            });
            return framework ? await this.checkOrganizationAccess(user, framework.organizationId) : false;
          }
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Create audit log entry for authorization check
   */
  logAuthorizationCheck(
    user: UserContext,
    action: Action,
    resource: Resource,
    resourceId: string | undefined,
    allowed: boolean,
  ): void {
    // In production, this would write to an audit log
    const logEntry = {
      timestamp: new Date(),
      userId: user.id,
      organizationId: user.organizationId,
      action,
      resource,
      resourceId,
      allowed,
      roles: user.roles,
    };
    
    // Log authorization checks in development
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug('Authorization check:', logEntry);
    }
  }

  /**
   * Get user's effective permissions based on roles
   */
  getEffectivePermissions(user: UserContext): string[] {
    const permissions = new Set<string>();

    // Define role-permission mappings
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // All permissions
      policy_manager: [
        'policy:create',
        'policy:read',
        'policy:update',
        'policy:delete',
        'policy:approve',
        'policy:publish',
        'policy:evaluate',
      ],
      compliance_manager: [
        'policy:create',
        'policy:read',
        'policy:update',
        'policy:approve',
        'policy:evaluate',
        'control:*',
        'risk:*',
        'framework:*',
      ],
      control_owner: [
        'control:create',
        'control:read',
        'control:update',
      ],
      risk_manager: [
        'risk:*',
      ],
      auditor: [
        'policy:read',
        'policy:evaluate',
        'control:read',
        'risk:read',
        'framework:read',
      ],
      policy_viewer: ['policy:read'],
      compliance_viewer: ['control:read', 'framework:read'],
      risk_viewer: ['risk:read'],
    };

    // Collect permissions from all roles
    user.roles.forEach(role => {
      const perms = rolePermissions[role] || [];
      perms.forEach(perm => permissions.add(perm));
    });

    // Add any direct permissions
    user.permissions?.forEach(perm => permissions.add(perm));

    return Array.from(permissions);
  }
}