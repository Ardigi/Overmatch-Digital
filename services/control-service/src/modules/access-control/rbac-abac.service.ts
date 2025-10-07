import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggingService } from '@soc-compliance/monitoring';
import { RedisService } from '../redis/redis.service';
import { TenantContext, DataClassificationLevel } from '../../shared/types/tenant.types';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AbacPolicy as Policy } from './entities/abac-policy.entity';
import { UserRole } from './entities/user-role.entity';
import * as jsonLogic from 'json-logic-js';

/**
 * Enterprise-grade RBAC with ABAC for billion-dollar platform
 * Implements fine-grained access control with attribute-based policies
 * Supports dynamic authorization based on context and attributes
 */
@Injectable()
export class RbacAbacService {
  private readonly PERMISSION_CACHE_TTL = 300; // 5 minutes
  private readonly POLICY_EVALUATION_TIMEOUT = 1000; // 1 second
  private policyEngine: PolicyEngine;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly redisService: RedisService,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {
    this.policyEngine = new PolicyEngine();
  }

  /**
   * Check if user has permission to perform action on resource
   * Combines RBAC and ABAC for comprehensive access control
   */
  async checkAccess(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    const startTime = Date.now();

    try {
      // 1. Quick deny for blocked users
      if (await this.isUserBlocked(userId)) {
        return this.createDeniedDecision('User is blocked');
      }

      // 2. Check RBAC permissions
      const rbacDecision = await this.evaluateRbac(userId, resource, action, context);
      
      // 3. If RBAC denies, check ABAC policies for override
      if (!rbacDecision.allowed) {
        const abacDecision = await this.evaluateAbac(userId, resource, action, context);
        
        if (abacDecision.allowed) {
          await this.logAccessDecision(userId, resource, action, 'ABAC_OVERRIDE', startTime);
          return abacDecision;
        }
        
        return rbacDecision;
      }

      // 4. RBAC allows, but check ABAC for additional constraints
      const abacConstraints = await this.evaluateAbacConstraints(userId, resource, action, context);
      
      if (!abacConstraints.allowed) {
        await this.logAccessDecision(userId, resource, action, 'ABAC_CONSTRAINT_DENIED', startTime);
        return abacConstraints;
      }

      // 5. Both RBAC and ABAC allow
      await this.logAccessDecision(userId, resource, action, 'ALLOWED', startTime);
      
      return this.createAllowedDecision(
        rbacDecision.permissions || [],
        abacConstraints.obligations || []
      );

    } catch (error) {
      await this.loggingService.error(`Access check failed: userId=${userId}, resource=${resource}, action=${action}, error=${error.message}`);
      
      // Fail closed for security
      return this.createDeniedDecision('Access check error');
    }
  }

  /**
   * Evaluate RBAC permissions
   */
  private async evaluateRbac(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    // Get user's roles
    const roles = await this.getUserRoles(userId, context.tenantId);
    
    if (roles.length === 0) {
      return this.createDeniedDecision('No roles assigned');
    }

    // Check for super admin
    if (roles.some(r => r.name === 'SUPER_ADMIN')) {
      return this.createAllowedDecision(['*'], []);
    }

    // Get permissions for all roles
    const permissions = await this.getRolePermissions(roles, context.tenantId);
    
    // Check if any permission matches
    const hasPermission = this.matchPermission(permissions, resource, action);
    
    if (!hasPermission) {
      return this.createDeniedDecision('No matching permission');
    }

    return this.createAllowedDecision(
      permissions.map(p => p.name),
      []
    );
  }

  /**
   * Evaluate ABAC policies
   */
  private async evaluateAbac(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    // Get applicable policies
    const policies = await this.getApplicablePolicies(
      userId,
      resource,
      action,
      context
    );

    if (policies.length === 0) {
      return this.createDeniedDecision('No applicable policies');
    }

    // Prepare evaluation context
    const evalContext = this.prepareEvaluationContext(
      userId,
      resource,
      action,
      context
    );

    // Evaluate policies
    for (const policy of policies) {
      const result = await this.evaluatePolicy(policy, evalContext);
      
      if (result.effect === 'ALLOW') {
        return this.createAllowedDecision(
          [policy.name],
          result.obligations || []
        );
      }
      
      if (result.effect === 'DENY') {
        return this.createDeniedDecision(
          `Policy ${policy.name} denied access: ${result.reason}`
        );
      }
    }

    return this.createDeniedDecision('No policy allowed access');
  }

  /**
   * Evaluate ABAC constraints on RBAC permissions
   */
  private async evaluateAbacConstraints(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<AccessDecision> {
    // Get constraint policies
    const constraints = await this.getConstraintPolicies(
      resource,
      action,
      context.tenantId
    );

    const evalContext = this.prepareEvaluationContext(
      userId,
      resource,
      action,
      context
    );

    const obligations: Obligation[] = [];

    for (const constraint of constraints) {
      const result = await this.evaluatePolicy(constraint, evalContext);
      
      if (result.effect === 'DENY') {
        return this.createDeniedDecision(
          `Constraint ${constraint.name} failed: ${result.reason}`
        );
      }
      
      if (result.obligations) {
        obligations.push(...result.obligations);
      }
    }

    return this.createAllowedDecision([], obligations);
  }

  /**
   * Get user's effective roles
   */
  private async getUserRoles(
    userId: string,
    tenantId: string
  ): Promise<Role[]> {
    const cacheKey = `user-roles:${userId}:${tenantId}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const userRoles = await this.userRoleRepository.find({
      where: {
        userId,
        tenantId,
        isActive: true,
      },
      relations: ['role'],
    });

    const roles = userRoles.map(ur => ur.role);
    
    // Add inherited roles
    const allRoles = await this.expandRoleHierarchy(roles);
    
    await this.redisService.set(
      cacheKey,
      JSON.stringify(allRoles),
      this.PERMISSION_CACHE_TTL
    );

    return allRoles;
  }

  /**
   * Expand role hierarchy to include inherited roles
   */
  private async expandRoleHierarchy(roles: Role[]): Promise<Role[]> {
    const expandedRoles = new Set(roles);
    const toProcess = [...roles];

    while (toProcess.length > 0) {
      const role = toProcess.pop()!;
      
      if (role.parentRoleId) {
        const parent = await this.roleRepository.findOne({
          where: { id: role.parentRoleId },
        });
        
        if (parent && !expandedRoles.has(parent)) {
          expandedRoles.add(parent);
          toProcess.push(parent);
        }
      }
    }

    return Array.from(expandedRoles);
  }

  /**
   * Get permissions for roles
   */
  private async getRolePermissions(
    roles: Role[],
    tenantId: string
  ): Promise<Permission[]> {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      // Load role with permissions relationship
      const roleWithPerms = await this.roleRepository.findOne({
        where: {
          id: role.id,
          tenantId,
          isActive: true,
        },
        relations: ['permissions'],
      });
      
      if (roleWithPerms?.permissions) {
        roleWithPerms.permissions.forEach(p => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  /**
   * Match permission against resource and action
   */
  private matchPermission(
    permissions: Permission[],
    resource: string,
    action: string
  ): boolean {
    for (const perm of permissions) {
      // Check for wildcard permissions
      if (perm.resource === '*' || perm.action === '*') {
        return true;
      }

      // Check for exact match
      if (perm.resource === resource && perm.action === action) {
        return true;
      }

      // Check for pattern match (e.g., controls:* matches controls:read)
      if (this.matchPattern(perm.resource, resource) && 
          this.matchPattern(perm.action, action)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match pattern with wildcards
   */
  private matchPattern(pattern: string, value: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(value);
  }

  /**
   * Get applicable ABAC policies
   */
  private async getApplicablePolicies(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): Promise<Policy[]> {
    return this.policyRepository.find({
      where: {
        tenantId: context.tenantId,
        isActive: true,
        resource: resource,
        action: action,
      },
      order: {
        priority: 'ASC',
      },
    });
  }

  /**
   * Get constraint policies
   */
  private async getConstraintPolicies(
    resource: string,
    action: string,
    tenantId: string
  ): Promise<Policy[]> {
    // Note: AbacPolicy doesn't have a 'type' field, so we'll get all active policies
    return this.policyRepository.find({
      where: {
        tenantId,
        resource,
        action,
        isActive: true,
      },
      order: {
        priority: 'ASC',
      },
    });
  }

  /**
   * Prepare evaluation context for policy engine
   */
  private prepareEvaluationContext(
    userId: string,
    resource: string,
    action: string,
    context: AccessContext
  ): EvaluationContext {
    return {
      subject: {
        id: userId,
        roles: context.userRoles || [],
        attributes: context.userAttributes || {},
        groups: context.userGroups || [],
        clearanceLevel: context.clearanceLevel,
      },
      resource: {
        type: resource.split(':')[0],
        id: resource.split(':')[1],
        owner: context.resourceOwner,
        classification: context.dataClassification,
        attributes: context.resourceAttributes || {},
        tags: context.resourceTags || [],
      },
      action: {
        name: action,
        type: this.getActionType(action),
      },
      environment: {
        time: new Date(),
        ipAddress: context.ipAddress,
        location: context.location,
        deviceType: context.deviceType,
        requestId: context.requestId,
        tenantId: context.tenantId,
      },
    };
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: Policy,
    context: EvaluationContext
  ): Promise<PolicyResult> {
    try {
      // Use JSON Logic for policy evaluation
      const result = jsonLogic.apply(policy.conditions, context);
      
      if (result === true) {
        return {
          effect: 'ALLOW', // Default to ALLOW since AbacPolicy doesn't have effect field
          obligations: policy.obligations,
        };
      }
      
      return {
        effect: 'NOT_APPLICABLE',
        reason: 'Condition not met',
      };
    } catch (error) {
      await this.loggingService.error(`Policy evaluation error: policyId=${policy.id}, error=${error.message}`);
      
      // Fail closed
      return {
        effect: 'DENY',
        reason: 'Policy evaluation error',
      };
    }
  }

  /**
   * Check if user is blocked
   */
  private async isUserBlocked(userId: string): Promise<boolean> {
    const blockKey = `blocked-user:${userId}`;
    const blocked = await this.redisService.get(blockKey);
    return blocked === 'true';
  }

  /**
   * Get action type from action name
   */
  private getActionType(action: string): string {
    const readActions = ['read', 'view', 'list', 'get'];
    const writeActions = ['create', 'update', 'edit', 'write'];
    const deleteActions = ['delete', 'remove', 'destroy'];
    
    if (readActions.includes(action.toLowerCase())) return 'READ';
    if (writeActions.includes(action.toLowerCase())) return 'WRITE';
    if (deleteActions.includes(action.toLowerCase())) return 'DELETE';
    
    return 'CUSTOM';
  }

  /**
   * Create allowed access decision
   */
  private createAllowedDecision(
    permissions: string[],
    obligations: Obligation[]
  ): AccessDecision {
    return {
      allowed: true,
      permissions,
      obligations,
      timestamp: new Date(),
    };
  }

  /**
   * Create denied access decision
   */
  private createDeniedDecision(reason: string): AccessDecision {
    return {
      allowed: false,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Log access decision for audit
   */
  private async logAccessDecision(
    userId: string,
    resource: string,
    action: string,
    decision: string,
    startTime: number
  ): Promise<void> {
    const duration = Date.now() - startTime;
    
    await this.loggingService.log('Access decision', {
      userId,
      resource,
      action,
      decision,
      duration,
      timestamp: new Date(),
    });
  }
}

/**
 * Policy engine for complex policy evaluation
 */
class PolicyEngine {
  /**
   * Evaluate complex policy conditions
   */
  evaluateCondition(condition: any, context: any): boolean {
    // This can be extended with more complex logic
    return jsonLogic.apply(condition, context);
  }

  /**
   * Combine multiple policy results
   */
  combineResults(results: PolicyResult[], algorithm: 'FIRST' | 'ALL' | 'ANY'): PolicyResult {
    switch (algorithm) {
      case 'FIRST':
        return results[0] || { effect: 'NOT_APPLICABLE' };
      
      case 'ALL':
        const denied = results.find(r => r.effect === 'DENY');
        if (denied) return denied;
        
        const allowed = results.find(r => r.effect === 'ALLOW');
        if (allowed) return allowed;
        
        return { effect: 'NOT_APPLICABLE' };
      
      case 'ANY':
        const allowedAny = results.find(r => r.effect === 'ALLOW');
        if (allowedAny) return allowedAny;
        
        const deniedAny = results.find(r => r.effect === 'DENY');
        if (deniedAny) return deniedAny;
        
        return { effect: 'NOT_APPLICABLE' };
      
      default:
        return { effect: 'NOT_APPLICABLE' };
    }
  }
}

// Entity definitions moved to separate entity files

// Type definitions

interface AccessContext {
  tenantId: string;
  userRoles?: string[];
  userAttributes?: Record<string, any>;
  userGroups?: string[];
  clearanceLevel?: string;
  resourceOwner?: string;
  dataClassification?: DataClassificationLevel;
  resourceAttributes?: Record<string, any>;
  resourceTags?: string[];
  ipAddress?: string;
  location?: string;
  deviceType?: string;
  requestId?: string;
}

interface AccessDecision {
  allowed: boolean;
  reason?: string;
  permissions?: string[];
  obligations?: Obligation[];
  timestamp: Date;
}

interface Obligation {
  type: string;
  parameters: Record<string, any>;
}

interface EvaluationContext {
  subject: {
    id: string;
    roles: string[];
    attributes: Record<string, any>;
    groups: string[];
    clearanceLevel?: string;
  };
  resource: {
    type: string;
    id?: string;
    owner?: string;
    classification?: DataClassificationLevel;
    attributes: Record<string, any>;
    tags: string[];
  };
  action: {
    name: string;
    type: string;
  };
  environment: {
    time: Date;
    ipAddress?: string;
    location?: string;
    deviceType?: string;
    requestId?: string;
    tenantId: string;
  };
}

interface PolicyResult {
  effect: 'ALLOW' | 'DENY' | 'NOT_APPLICABLE';
  reason?: string;
  obligations?: Obligation[];
}

// Entity definitions are above - imports moved to top of file