import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, RolePermission, User, UserRole } from '../users/entities';

export interface PermissionCheck {
  resource: string;
  action: string;
  resourceId?: string;
  context?: Record<string, any>;
}

export interface ResourcePermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

@Injectable()
export class PermissionService {
  private permissionCache: Map<string, ResourcePermission[]> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  /**
   * Check if user has permission to perform action on resource
   */
  async hasPermission(
    userId: string,
    check: PermissionCheck,
  ): Promise<boolean> {
    // Get user permissions
    const permissions = await this.getUserPermissions(userId);

    // Check for exact match
    const hasExactPermission = permissions.some(perm => 
      perm.resource === check.resource &&
      perm.actions.includes(check.action) &&
      this.evaluateConditions(perm.conditions, check.context),
    );

    if (hasExactPermission) {
      return true;
    }

    // Check for wildcard permissions
    const hasWildcardPermission = permissions.some(perm => {
      // Resource wildcard (e.g., "*" or "users:*")
      if (perm.resource === '*' || perm.resource === `${check.resource.split(':')[0]}:*`) {
        return perm.actions.includes(check.action) || perm.actions.includes('*');
      }

      // Action wildcard (e.g., "users:read,write,*")
      if (perm.resource === check.resource && perm.actions.includes('*')) {
        return true;
      }

      return false;
    });

    return hasWildcardPermission;
  }

  /**
   * Require permission or throw ForbiddenException
   */
  async requirePermission(
    userId: string,
    check: PermissionCheck,
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, check);
    
    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have permission to ${check.action} ${check.resource}`,
      );
    }
  }

  /**
   * Check multiple permissions (all must pass)
   */
  async hasAllPermissions(
    userId: string,
    checks: PermissionCheck[],
  ): Promise<boolean> {
    for (const check of checks) {
      if (!(await this.hasPermission(userId, check))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check multiple permissions (any can pass)
   */
  async hasAnyPermission(
    userId: string,
    checks: PermissionCheck[],
  ): Promise<boolean> {
    for (const check of checks) {
      if (await this.hasPermission(userId, check)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<ResourcePermission[]> {
    // Check cache first
    const cacheKey = `user:${userId}`;
    const cached = this.permissionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user with roles and permissions
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'userRoles',
        'userRoles.role',
        'userRoles.role.rolePermissions',
        'userRoles.role.rolePermissions.permission',
      ],
    });

    if (!user) {
      return [];
    }

    // Aggregate permissions from all roles
    const permissionMap = new Map<string, ResourcePermission>();

    for (const userRole of user.userRoles || []) {
      // Skip expired roles
      if (userRole.isExpired()) {
        continue;
      }

      for (const rolePermission of userRole.role?.rolePermissions || []) {
        const perm = rolePermission.permission;
        const key = `${perm.resource}:${JSON.stringify(perm.conditions || {})}`;

        if (!permissionMap.has(key)) {
          permissionMap.set(key, {
            resource: perm.resource,
            actions: [],
            conditions: perm.conditions,
          });
        }

        const resourcePerm = permissionMap.get(key)!;
        
        // Add actions if not already present
        for (const action of perm.actions) {
          if (!resourcePerm.actions.includes(action)) {
            resourcePerm.actions.push(action);
          }
        }
      }
    }

    const permissions = Array.from(permissionMap.values());

    // Cache the result
    this.permissionCache.set(cacheKey, permissions);
    setTimeout(() => this.permissionCache.delete(cacheKey), this.cacheTimeout);

    return permissions;
  }

  /**
   * Get permissions for a specific resource
   */
  async getResourcePermissions(
    userId: string,
    resource: string,
  ): Promise<string[]> {
    const permissions = await this.getUserPermissions(userId);
    
    const actions = new Set<string>();

    for (const perm of permissions) {
      if (perm.resource === resource || 
          perm.resource === '*' || 
          perm.resource === `${resource.split(':')[0]}:*`) {
        for (const action of perm.actions) {
          actions.add(action);
        }
      }
    }

    return Array.from(actions);
  }

  /**
   * Filter resources based on permissions
   */
  async filterByPermission<T extends { id: string }>(
    userId: string,
    resources: T[],
    resource: string,
    action: string,
  ): Promise<T[]> {
    const filtered: T[] = [];

    for (const item of resources) {
      const hasPermission = await this.hasPermission(userId, {
        resource,
        action,
        resourceId: item.id,
      });

      if (hasPermission) {
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { resource: 'ASC', action: 'ASC' }
    });
  }

  /**
   * Create a new permission
   */
  async createPermission(
    data: {
      resource: string;
      action: string;
      name: string;
      code?: string;
      description?: string;
      conditions?: Record<string, any>;
    },
  ): Promise<Permission> {
    // For backward compatibility, support both formats
    const permissionData = {
      code: data.code || `${data.resource}:${data.action}`,
      name: data.name,
      description: data.description,
      resource: data.resource,
      actions: [data.action], // Convert single action to array
      conditions: data.conditions,
    };
    
    const permission = this.permissionRepository.create(permissionData);
    return this.permissionRepository.save(permission);
  }

  /**
   * Update an existing permission
   */
  async updatePermission(
    id: string,
    updates: Partial<Permission>
  ): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({ where: { id } });
    
    if (!permission) {
      throw new ForbiddenException('Permission not found');
    }

    Object.assign(permission, updates);
    return this.permissionRepository.save(permission);
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string): Promise<void> {
    await this.permissionRepository.delete(id);
  }

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (!existing) {
      const rolePermission = this.rolePermissionRepository.create({
        roleId,
        permissionId,
      });
      await this.rolePermissionRepository.save(rolePermission);
    }

    // Clear cache for all users with this role
    this.clearRoleCache(roleId);
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.rolePermissionRepository.delete({
      roleId,
      permissionId,
    });

    // Clear cache for all users with this role
    this.clearRoleCache(roleId);
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions?: Record<string, any>,
    context?: Record<string, any>,
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    if (!context) {
      return false;
    }

    // Simple condition evaluation
    // In production, consider using a more robust rule engine
    for (const [key, value] of Object.entries(conditions)) {
      if (key === 'organizationId') {
        if (context.organizationId !== value) {
          return false;
        }
      } else if (key === 'ownerId') {
        if (context.ownerId !== value && context.userId !== value) {
          return false;
        }
      } else if (key === 'scope') {
        if (!this.evaluateScope(value as string, context)) {
          return false;
        }
      } else {
        // Generic condition check - if condition key exists in context, values must match
        if (!(key in context) || context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate scope conditions
   */
  private evaluateScope(scope: string, context: Record<string, any>): boolean {
    switch (scope) {
      case 'own':
        return context.ownerId === context.userId;
      case 'organization':
        return context.organizationId === context.userOrganizationId;
      case 'subordinate':
        // Check if user manages the resource owner
        return context.isManager === true;
      default:
        return false;
    }
  }

  /**
   * Clear cache for all users with a specific role
   */
  private async clearRoleCache(roleId: string): Promise<void> {
    // In production, use Redis or similar for distributed cache
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
    });

    if (userRoles && Array.isArray(userRoles)) {
      for (const userRole of userRoles) {
        this.permissionCache.delete(`user:${userRole.userId}`);
      }
    }
  }

  /**
   * Clear all permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get permission hierarchy
   */
  getPermissionHierarchy(): Record<string, string[]> {
    return {
      'admin': ['*'],
      'users:*': ['users:read', 'users:write', 'users:delete'],
      'organizations:*': ['organizations:read', 'organizations:write', 'organizations:delete'],
      'audits:*': ['audits:read', 'audits:write', 'audits:delete', 'audits:execute'],
      'policies:*': ['policies:read', 'policies:write', 'policies:delete', 'policies:approve'],
      'evidence:*': ['evidence:read', 'evidence:write', 'evidence:delete', 'evidence:collect'],
      'reports:*': ['reports:read', 'reports:write', 'reports:delete', 'reports:generate'],
      'workflows:*': ['workflows:read', 'workflows:write', 'workflows:delete', 'workflows:execute'],
    };
  }
}