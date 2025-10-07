import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_CHECK_KEY = 'permissionCheck';

/**
 * Require specific permissions
 * @param permissions Array of permission strings (e.g., ['users:read', 'users:write'])
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Alias for RequirePermissions for backward compatibility
 */
export const Permissions = RequirePermissions;

/**
 * Custom permission check function
 * @param checkFn Function that receives request and permission service
 */
export const PermissionCheck = (checkFn: (req: any, permissionService: any) => Promise<boolean>) =>
  SetMetadata(PERMISSION_CHECK_KEY, checkFn);

/**
 * Common permission decorators
 */
export const CanReadUsers = () => RequirePermissions('users:read');
export const CanWriteUsers = () => RequirePermissions('users:write');
export const CanDeleteUsers = () => RequirePermissions('users:delete');

export const CanReadOrganizations = () => RequirePermissions('organizations:read');
export const CanWriteOrganizations = () => RequirePermissions('organizations:write');
export const CanDeleteOrganizations = () => RequirePermissions('organizations:delete');

export const CanReadAudits = () => RequirePermissions('audits:read');
export const CanWriteAudits = () => RequirePermissions('audits:write');
export const CanExecuteAudits = () => RequirePermissions('audits:execute');

export const CanReadPolicies = () => RequirePermissions('policies:read');
export const CanWritePolicies = () => RequirePermissions('policies:write');
export const CanApprovePolicies = () => RequirePermissions('policies:approve');

export const IsAdmin = () => RequirePermissions('admin:*');

/**
 * Check if user can access their own resource
 */
export const CanAccessOwnResource = (resourceIdParam = 'id') =>
  PermissionCheck(async (req, permissionService) => {
    const userId = req.user.id;
    const resourceId = req.params[resourceIdParam];

    // User can always access their own resources
    if (userId === resourceId) {
      return true;
    }

    // Otherwise check for admin permission
    return permissionService.hasPermission(userId, {
      resource: 'admin',
      action: '*',
    });
  });

/**
 * Check if user can access resources in their organization
 */
export const CanAccessOrganizationResource = (resource: string, action: string) =>
  PermissionCheck(async (req, permissionService) => {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return permissionService.hasPermission(userId, {
      resource,
      action,
      context: { organizationId },
    });
  });
