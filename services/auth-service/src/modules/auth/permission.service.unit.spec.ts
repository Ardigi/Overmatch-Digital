import { ForbiddenException } from '@nestjs/common';
import {
  type PermissionCheck,
  PermissionService,
  type ResourcePermission,
} from './permission.service';

describe('PermissionService (Unit)', () => {
  let service: PermissionService;
  let userRepository: any;
  let userRoleRepository: any;
  let rolePermissionRepository: any;
  let permissionRepository: any;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: [
      {
        id: 'role-1',
        name: 'admin',
        roleId: 'role-1',
      },
    ],
  };

  const mockPermissions = [
    {
      id: 'perm-1',
      resource: 'users',
      actions: ['read'],
      name: 'Read Users',
    },
    {
      id: 'perm-2',
      resource: 'users',
      actions: ['write'],
      name: 'Write Users',
    },
    {
      id: 'perm-3',
      resource: 'reports',
      actions: ['read'],
      name: 'Read Reports',
      conditions: { departmentMatch: true },
    },
  ];

  const mockRolePermissions = [
    {
      roleId: 'role-1',
      permissionId: 'perm-1',
      permission: mockPermissions[0],
    },
    {
      roleId: 'role-1',
      permissionId: 'perm-2',
      permission: mockPermissions[1],
    },
    {
      roleId: 'role-1',
      permissionId: 'perm-3',
      permission: mockPermissions[2],
    },
  ];

  beforeEach(() => {
    // Create mock repositories
    userRepository = {
      findOne: jest.fn(),
    };

    userRoleRepository = {
      find: jest.fn(),
    };

    rolePermissionRepository = {
      find: jest.fn(),
    };

    permissionRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };

    // Create service instance with mocked dependencies
    service = new PermissionService(
      userRepository,
      userRoleRepository,
      rolePermissionRepository,
      permissionRepository
    );
  });

  describe('hasPermission', () => {
    it('should return true for user with exact permission', async () => {
      const check: PermissionCheck = {
        resource: 'users',
        action: 'read',
      };

      // Mock the internal method
      jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue([
        {
          resource: 'users',
          actions: ['read', 'write'],
        },
      ]);

      const result = await service.hasPermission('user-123', check);

      expect(result).toBe(true);
    });

    it('should return false for user without permission', async () => {
      const check: PermissionCheck = {
        resource: 'billing',
        action: 'write',
      };

      jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue([
        {
          resource: 'users',
          actions: ['read', 'write'],
        },
      ]);

      const result = await service.hasPermission('user-123', check);

      expect(result).toBe(false);
    });

    it('should check wildcard permissions', async () => {
      const check: PermissionCheck = {
        resource: 'reports',
        action: 'read',
      };

      jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue([
        {
          resource: '*',
          actions: ['*'],
        },
      ]);

      const result = await service.hasPermission('user-123', check);

      expect(result).toBe(true);
    });

    it('should evaluate conditions when provided', async () => {
      const check: PermissionCheck = {
        resource: 'reports',
        action: 'read',
        context: { departmentMatch: true },
      };

      jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue([
        {
          resource: 'reports',
          actions: ['read'],
          conditions: { departmentMatch: true },
        },
      ]);

      const result = await service.hasPermission('user-123', check);

      expect(result).toBe(true);
    });

    it('should return false when conditions do not match', async () => {
      const check: PermissionCheck = {
        resource: 'reports',
        action: 'read',
        context: { departmentMatch: false },
      };

      jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue([
        {
          resource: 'reports',
          actions: ['read'],
          conditions: { departmentMatch: true },
        },
      ]);

      const result = await service.hasPermission('user-123', check);

      expect(result).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw when user has permission', async () => {
      const check: PermissionCheck = {
        resource: 'users',
        action: 'read',
      };

      jest.spyOn(service, 'hasPermission').mockResolvedValue(true);

      await expect(service.requirePermission('user-123', check)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      const check: PermissionCheck = {
        resource: 'billing',
        action: 'delete',
      };

      jest.spyOn(service, 'hasPermission').mockResolvedValue(false);

      await expect(service.requirePermission('user-123', check)).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete billing')
      );
    });
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions if available', async () => {
      const cachedPermissions: ResourcePermission[] = [
        {
          resource: 'cached',
          actions: ['read'],
        },
      ];

      // Set cache
      (service as any).permissionCache.set('user:user-123', cachedPermissions);

      const result = await (service as any).getUserPermissions('user-123');

      expect(result).toEqual(cachedPermissions);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch permissions when cache is expired', async () => {
      const mockUserWithRoles = {
        ...mockUser,
        userRoles: [
          {
            roleId: 'role-1',
            isExpired: () => false,
            role: {
              rolePermissions: mockRolePermissions,
            },
          },
        ],
      };

      userRepository.findOne.mockResolvedValue(mockUserWithRoles);

      const result = await (service as any).getUserPermissions('user-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        relations: [
          'userRoles',
          'userRoles.role',
          'userRoles.role.rolePermissions',
          'userRoles.role.rolePermissions.permission',
        ],
      });
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resource: 'users',
            actions: expect.arrayContaining(['read', 'write']),
          }),
          expect.objectContaining({
            resource: 'reports',
            actions: expect.arrayContaining(['read']),
          }),
        ])
      );
    });

    it('should aggregate permissions by resource', async () => {
      const mockUserWithMultiplePermissions = {
        ...mockUser,
        userRoles: [
          {
            roleId: 'role-1',
            isExpired: () => false,
            role: {
              rolePermissions: [
                {
                  permission: {
                    resource: 'users',
                    actions: ['read'],
                    conditions: null,
                  },
                },
                {
                  permission: {
                    resource: 'users',
                    actions: ['write'],
                    conditions: null,
                  },
                },
              ],
            },
          },
        ],
      };

      userRepository.findOne.mockResolvedValue(mockUserWithMultiplePermissions);

      const result = await (service as any).getUserPermissions('user-123');

      expect(result).toContainEqual({
        resource: 'users',
        actions: ['read', 'write'],
        conditions: null,
      });
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      permissionRepository.find.mockResolvedValue(mockPermissions);

      const result = await service.getAllPermissions();

      expect(result).toEqual(mockPermissions);
      expect(permissionRepository.find).toHaveBeenCalledWith({
        order: { resource: 'ASC', action: 'ASC' },
      });
    });
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const newPermission = {
        resource: 'invoices',
        action: 'create',
        name: 'Create Invoices',
      };

      const createdPermission = {
        code: 'invoices:create',
        name: 'Create Invoices',
        resource: 'invoices',
        actions: ['create'],
      };

      permissionRepository.create.mockReturnValue(createdPermission);
      permissionRepository.save.mockResolvedValue({
        id: 'perm-new',
        ...createdPermission,
      });

      const result = await service.createPermission(newPermission);

      expect(result).toEqual({
        id: 'perm-new',
        ...createdPermission,
      });
      expect(permissionRepository.create).toHaveBeenCalledWith({
        code: 'invoices:create',
        name: 'Create Invoices',
        resource: 'invoices',
        actions: ['create'],
        conditions: undefined,
        description: undefined,
      });
      expect(permissionRepository.save).toHaveBeenCalledWith(createdPermission);
    });
  });

  describe('updatePermission', () => {
    it('should update an existing permission', async () => {
      const updates = {
        name: 'Updated Permission Name',
        description: 'New description',
      };

      permissionRepository.findOne.mockResolvedValue(mockPermissions[0]);
      permissionRepository.save.mockResolvedValue({
        ...mockPermissions[0],
        ...updates,
      });

      const result = await service.updatePermission('perm-1', updates);

      expect(result).toEqual({
        ...mockPermissions[0],
        ...updates,
      });
    });

    it('should throw if permission not found', async () => {
      permissionRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePermission('non-existent', {})).rejects.toThrow(
        new ForbiddenException('Permission not found')
      );
    });
  });

  describe('deletePermission', () => {
    it('should delete a permission', async () => {
      permissionRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermission('perm-1');

      expect(permissionRepository.delete).toHaveBeenCalledWith('perm-1');
    });
  });

  describe('evaluateConditions', () => {
    it('should return true when no conditions', () => {
      const result = (service as any).evaluateConditions(undefined, {});
      expect(result).toBe(true);
    });

    it('should return true when all conditions match', () => {
      const conditions = {
        departmentMatch: true,
        isOwner: true,
      };
      const context = {
        departmentMatch: true,
        isOwner: true,
      };

      const result = (service as any).evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should return false when any condition does not match', () => {
      const conditions = {
        departmentMatch: true,
        isOwner: true,
      };
      const context = {
        departmentMatch: true,
        isOwner: false,
      };

      const result = (service as any).evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });

    it('should handle missing context values', () => {
      const conditions = {
        requiredField: true,
      };
      const context = {};

      const result = (service as any).evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });
  });
});
