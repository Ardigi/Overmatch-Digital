import { ForbiddenException } from '@nestjs/common';
import { Permission, RolePermission, User, UserRole } from '../users/entities';
import { type PermissionCheck, PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let mockUserRepository: any;
  let mockUserRoleRepository: any;
  let mockRolePermissionRepository: any;
  let mockPermissionRepository: any;

  const mockPermission = {
    id: 'perm-123',
    resource: 'users',
    action: 'read',
    actions: ['read'],
    conditions: {},
  };

  const mockRole = {
    id: 'role-123',
    name: 'User',
    rolePermissions: [
      {
        permission: mockPermission,
      },
    ],
  };

  const mockUserRole = {
    id: 'ur-123',
    userId: 'user-123',
    roleId: 'role-123',
    role: mockRole,
    expiresAt: null,
    isExpired: jest.fn().mockReturnValue(false),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    userRoles: [mockUserRole],
  };

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
    };

    mockUserRoleRepository = {
      find: jest.fn(),
    };

    mockRolePermissionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockPermissionRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    // Manual instantiation
    service = new PermissionService(
      mockUserRepository,
      mockUserRoleRepository,
      mockRolePermissionRepository,
      mockPermissionRepository
    );

    jest.clearAllMocks();
    // Clear the cache before each test
    service.clearCache();
  });

  describe('hasPermission', () => {
    const permissionCheck: PermissionCheck = {
      resource: 'users',
      action: 'read',
    };

    it('should return true for exact permission match', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-123', permissionCheck);

      expect(result).toBe(true);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        relations: [
          'userRoles',
          'userRoles.role',
          'userRoles.role.rolePermissions',
          'userRoles.role.rolePermissions.permission',
        ],
      });
    });

    it('should return false for no permission match', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-123', {
        resource: 'organizations',
        action: 'delete',
      });

      expect(result).toBe(false);
    });

    it('should return true for wildcard resource permission', async () => {
      const adminUser = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    id: 'perm-admin',
                    resource: '*',
                    actions: ['read', 'write', 'delete'],
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(adminUser);

      const result = await service.hasPermission('user-123', permissionCheck);

      expect(result).toBe(true);
    });

    it('should return true for wildcard action permission', async () => {
      const powerUser = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    id: 'perm-power',
                    resource: 'users',
                    actions: ['*'],
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(powerUser);

      const result = await service.hasPermission('user-123', {
        resource: 'users',
        action: 'delete',
      });

      expect(result).toBe(true);
    });

    it('should return true for prefix wildcard permission', async () => {
      const moduleAdmin = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    id: 'perm-module',
                    resource: 'users:*',
                    actions: ['read'],
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(moduleAdmin);

      const result = await service.hasPermission('user-123', {
        resource: 'users:profile',
        action: 'read',
      });

      expect(result).toBe(true);
    });

    it('should skip expired user roles', async () => {
      const userWithExpiredRole = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            isExpired: jest.fn().mockReturnValue(true),
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithExpiredRole);

      const result = await service.hasPermission('user-123', permissionCheck);

      expect(result).toBe(false);
    });

    it('should cache permissions for subsequent calls', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // First call
      await service.hasPermission('user-123', permissionCheck);
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.hasPermission('user-123', permissionCheck);
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle user with no roles', async () => {
      const userWithNoRoles = {
        ...mockUser,
        userRoles: [],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithNoRoles);

      const result = await service.hasPermission('user-123', permissionCheck);

      expect(result).toBe(false);
    });

    it('should handle non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.hasPermission('user-123', permissionCheck);

      expect(result).toBe(false);
    });

    it('should evaluate conditions correctly', async () => {
      const userWithConditionalPerm = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    id: 'perm-cond',
                    resource: 'documents',
                    actions: ['read'],
                    conditions: { organizationId: 'org-123' },
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithConditionalPerm);

      // Should return true with matching context
      const resultWithContext = await service.hasPermission('user-123', {
        resource: 'documents',
        action: 'read',
        context: { organizationId: 'org-123' },
      });
      expect(resultWithContext).toBe(true);

      // Should return false without matching context
      const resultWithoutContext = await service.hasPermission('user-123', {
        resource: 'documents',
        action: 'read',
        context: { organizationId: 'org-456' },
      });
      expect(resultWithoutContext).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw if permission is granted', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.requirePermission('user-123', {
          resource: 'users',
          action: 'read',
        })
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if permission is denied', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.requirePermission('user-123', {
          resource: 'organizations',
          action: 'delete',
        })
      ).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete organizations')
      );
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if all permissions are granted', async () => {
      const multiPermUser = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    id: 'perm-1',
                    resource: 'users',
                    actions: ['read', 'write'],
                  },
                },
                {
                  permission: {
                    id: 'perm-2',
                    resource: 'organizations',
                    actions: ['read'],
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(multiPermUser);

      const result = await service.hasAllPermissions('user-123', [
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'write' },
        { resource: 'organizations', action: 'read' },
      ]);

      expect(result).toBe(true);
    });

    it('should return false if any permission is denied', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAllPermissions('user-123', [
        { resource: 'users', action: 'read' },
        { resource: 'organizations', action: 'delete' }, // This one is denied
      ]);

      expect(result).toBe(false);
    });

    it('should return true for empty permissions array', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAllPermissions('user-123', []);

      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if any permission is granted', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAnyPermission('user-123', [
        { resource: 'organizations', action: 'delete' }, // Denied
        { resource: 'users', action: 'read' }, // Granted
      ]);

      expect(result).toBe(true);
    });

    it('should return false if all permissions are denied', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAnyPermission('user-123', [
        { resource: 'organizations', action: 'delete' },
        { resource: 'policies', action: 'approve' },
      ]);

      expect(result).toBe(false);
    });

    it('should return false for empty permissions array', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAnyPermission('user-123', []);

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return aggregated permissions from all roles', async () => {
      const multiRoleUser = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              id: 'role-1',
              rolePermissions: [
                {
                  permission: { resource: 'users', actions: ['read'] },
                },
              ],
            },
          },
          {
            ...mockUserRole,
            roleId: 'role-2',
            role: {
              id: 'role-2',
              rolePermissions: [
                {
                  permission: { resource: 'users', actions: ['write'] },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(multiRoleUser);

      const result = await service.getUserPermissions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        resource: 'users',
        actions: ['read', 'write'],
        conditions: undefined,
      });
    });

    it('should handle permissions with different conditions separately', async () => {
      const userWithConditionalPerms = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    resource: 'documents',
                    actions: ['read'],
                    conditions: { organizationId: 'org-123' },
                  },
                },
                {
                  permission: {
                    resource: 'documents',
                    actions: ['write'],
                    conditions: { organizationId: 'org-456' },
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithConditionalPerms);

      const result = await service.getUserPermissions('user-123');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        resource: 'documents',
        actions: ['read'],
        conditions: { organizationId: 'org-123' },
      });
      expect(result).toContainEqual({
        resource: 'documents',
        actions: ['write'],
        conditions: { organizationId: 'org-456' },
      });
    });
  });

  describe('getResourcePermissions', () => {
    it('should return actions for specific resource', async () => {
      const userWithMultiplePerms = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: { resource: 'users', actions: ['read', 'write'] },
                },
                {
                  permission: { resource: 'organizations', actions: ['read'] },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithMultiplePerms);

      const result = await service.getResourcePermissions('user-123', 'users');

      expect(result).toEqual(['read', 'write']);
    });

    it('should include wildcard permissions', async () => {
      const userWithWildcard = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: { resource: 'users', actions: ['read'] },
                },
                {
                  permission: { resource: '*', actions: ['admin'] },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithWildcard);

      const result = await service.getResourcePermissions('user-123', 'users');

      expect(result).toContain('read');
      expect(result).toContain('admin');
    });
  });

  describe('filterByPermission', () => {
    const resources = [
      { id: 'doc-1', name: 'Document 1' },
      { id: 'doc-2', name: 'Document 2' },
      { id: 'doc-3', name: 'Document 3' },
    ];

    it('should filter resources based on permissions', async () => {
      const hasPermissionSpy = jest.spyOn(service, 'hasPermission');
      hasPermissionSpy
        .mockResolvedValueOnce(true) // doc-1
        .mockResolvedValueOnce(false) // doc-2
        .mockResolvedValueOnce(true); // doc-3

      const result = await service.filterByPermission('user-123', resources, 'documents', 'read');

      expect(result).toEqual([
        { id: 'doc-1', name: 'Document 1' },
        { id: 'doc-3', name: 'Document 3' },
      ]);
      expect(hasPermissionSpy).toHaveBeenCalledTimes(3);
    });

    it('should return empty array if no permissions', async () => {
      jest.spyOn(service, 'hasPermission').mockResolvedValue(false);

      const result = await service.filterByPermission('user-123', resources, 'documents', 'read');

      expect(result).toEqual([]);
    });
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const permissionData = {
        code: 'users:manage',
        name: 'Manage Users',
        description: 'Full user management',
        resource: 'users',
        action: 'manage',
      };

      const createdPermission = {
        id: 'perm-new',
        code: 'users:manage',
        name: 'Manage Users',
        description: 'Full user management',
        resource: 'users',
        actions: ['manage'],
      };

      mockPermissionRepository.create.mockReturnValue(createdPermission);
      mockPermissionRepository.save.mockResolvedValue(createdPermission);

      const result = await service.createPermission(permissionData);

      expect(result).toEqual(createdPermission);
      expect(mockPermissionRepository.create).toHaveBeenCalledWith({
        code: 'users:manage',
        name: 'Manage Users',
        description: 'Full user management',
        resource: 'users',
        actions: ['manage'],
        conditions: undefined,
      });
      expect(mockPermissionRepository.save).toHaveBeenCalledWith(createdPermission);
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role', async () => {
      mockRolePermissionRepository.findOne.mockResolvedValue(null);
      const rolePermission = {
        roleId: 'role-123',
        permissionId: 'perm-123',
      };
      mockRolePermissionRepository.create.mockReturnValue(rolePermission);
      mockRolePermissionRepository.save.mockResolvedValue(rolePermission);
      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);

      await service.assignPermissionToRole('role-123', 'perm-123');

      expect(mockRolePermissionRepository.findOne).toHaveBeenCalledWith({
        where: { roleId: 'role-123', permissionId: 'perm-123' },
      });
      expect(mockRolePermissionRepository.create).toHaveBeenCalledWith({
        roleId: 'role-123',
        permissionId: 'perm-123',
      });
      expect(mockRolePermissionRepository.save).toHaveBeenCalledWith(rolePermission);
    });

    it('should not create duplicate role permission', async () => {
      mockRolePermissionRepository.findOne.mockResolvedValue({
        id: 'rp-existing',
        roleId: 'role-123',
        permissionId: 'perm-123',
      });

      await service.assignPermissionToRole('role-123', 'perm-123');

      expect(mockRolePermissionRepository.create).not.toHaveBeenCalled();
      expect(mockRolePermissionRepository.save).not.toHaveBeenCalled();
    });

    it('should clear cache for affected users', async () => {
      mockRolePermissionRepository.findOne.mockResolvedValue(null);
      mockRolePermissionRepository.create.mockReturnValue({});
      mockRolePermissionRepository.save.mockResolvedValue({});
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: 'user-1', roleId: 'role-123' },
        { userId: 'user-2', roleId: 'role-123' },
      ]);

      const clearCacheSpy = jest.spyOn(service as any, 'clearRoleCache');

      await service.assignPermissionToRole('role-123', 'perm-123');

      expect(clearCacheSpy).toHaveBeenCalledWith('role-123');
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role', async () => {
      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);

      await service.removePermissionFromRole('role-123', 'perm-123');

      expect(mockRolePermissionRepository.delete).toHaveBeenCalledWith({
        roleId: 'role-123',
        permissionId: 'perm-123',
      });
    });

    it('should clear cache for affected users', async () => {
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: 'user-1', roleId: 'role-123' },
        { userId: 'user-2', roleId: 'role-123' },
      ]);

      const clearCacheSpy = jest.spyOn(service as any, 'clearRoleCache');

      await service.removePermissionFromRole('role-123', 'perm-123');

      expect(clearCacheSpy).toHaveBeenCalledWith('role-123');
    });
  });

  describe('getPermissionHierarchy', () => {
    it('should return permission hierarchy', () => {
      const hierarchy = service.getPermissionHierarchy();

      expect(hierarchy).toHaveProperty('admin');
      expect(hierarchy['admin']).toEqual(['*']);
      expect(hierarchy).toHaveProperty('users:*');
      expect(hierarchy['users:*']).toContain('users:read');
      expect(hierarchy['users:*']).toContain('users:write');
      expect(hierarchy['users:*']).toContain('users:delete');
    });
  });

  describe('clearCache', () => {
    it('should clear all permission cache', async () => {
      // Populate cache first
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      await service.hasPermission('user-123', { resource: 'users', action: 'read' });

      // Verify cache is populated
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Should fetch again after cache clear
      await service.hasPermission('user-123', { resource: 'users', action: 'read' });
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('condition evaluation', () => {
    describe('organizationId condition', () => {
      it('should pass when organizationId matches', async () => {
        const userWithOrgPerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['read'],
                      conditions: { organizationId: 'org-123' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithOrgPerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'read',
          context: { organizationId: 'org-123' },
        });

        expect(result).toBe(true);
      });

      it('should fail when organizationId does not match', async () => {
        const userWithOrgPerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['read'],
                      conditions: { organizationId: 'org-123' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithOrgPerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'read',
          context: { organizationId: 'org-456' },
        });

        expect(result).toBe(false);
      });
    });

    describe('ownerId condition', () => {
      it('should pass when ownerId matches context ownerId', async () => {
        const userWithOwnerPerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['edit'],
                      conditions: { ownerId: 'user-123' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithOwnerPerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'edit',
          context: { ownerId: 'user-123' },
        });

        expect(result).toBe(true);
      });

      it('should pass when ownerId matches context userId', async () => {
        const userWithOwnerPerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['edit'],
                      conditions: { ownerId: 'user-123' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithOwnerPerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'edit',
          context: { userId: 'user-123' },
        });

        expect(result).toBe(true);
      });
    });

    describe('scope condition', () => {
      it('should handle own scope', async () => {
        const userWithScopePerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['delete'],
                      conditions: { scope: 'own' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithScopePerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'delete',
          context: { ownerId: 'user-123', userId: 'user-123' },
        });

        expect(result).toBe(true);
      });

      it('should handle organization scope', async () => {
        const userWithScopePerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'documents',
                      actions: ['approve'],
                      conditions: { scope: 'organization' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithScopePerm);

        const result = await service.hasPermission('user-123', {
          resource: 'documents',
          action: 'approve',
          context: {
            organizationId: 'org-123',
            userOrganizationId: 'org-123',
          },
        });

        expect(result).toBe(true);
      });

      it('should handle subordinate scope', async () => {
        const userWithScopePerm = {
          ...mockUser,
          userRoles: [
            {
              ...mockUserRole,
              role: {
                ...mockRole,
                rolePermissions: [
                  {
                    permission: {
                      resource: 'reports',
                      actions: ['view'],
                      conditions: { scope: 'subordinate' },
                    },
                  },
                ],
              },
            },
          ],
        };
        mockUserRepository.findOne.mockResolvedValue(userWithScopePerm);

        const result = await service.hasPermission('user-123', {
          resource: 'reports',
          action: 'view',
          context: { isManager: true },
        });

        expect(result).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle user with null userRoles', async () => {
      const userWithNullRoles = {
        ...mockUser,
        userRoles: null,
      };
      mockUserRepository.findOne.mockResolvedValue(userWithNullRoles);

      const result = await service.hasPermission('user-123', {
        resource: 'users',
        action: 'read',
      });

      expect(result).toBe(false);
    });

    it('should handle role with null rolePermissions', async () => {
      const userWithNullRolePerms = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: null,
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithNullRolePerms);

      const result = await service.hasPermission('user-123', {
        resource: 'users',
        action: 'read',
      });

      expect(result).toBe(false);
    });

    it('should handle permission with empty actions array', async () => {
      const userWithEmptyActions = {
        ...mockUser,
        userRoles: [
          {
            ...mockUserRole,
            role: {
              ...mockRole,
              rolePermissions: [
                {
                  permission: {
                    resource: 'users',
                    actions: [],
                  },
                },
              ],
            },
          },
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithEmptyActions);

      const result = await service.hasPermission('user-123', {
        resource: 'users',
        action: 'read',
      });

      expect(result).toBe(false);
    });
  });
});
