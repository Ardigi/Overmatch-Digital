import type { DataSource } from 'typeorm';
import { Permission, Role, RolePermission, RoleType } from '../../modules/users/entities';

export async function seedRolesAndPermissions(dataSource: DataSource) {
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);
  const rolePermissionRepository = dataSource.getRepository(RolePermission);

  // Create permissions
  const permissions = [
    // Admin permissions
    {
      code: 'admin:all',
      name: 'Full Admin Access',
      description: 'Full access to all resources',
      resource: 'admin',
      actions: ['*'],
    },

    // User permissions
    {
      code: 'users:read',
      name: 'Read Users',
      description: 'View user information',
      resource: 'users',
      actions: ['read', 'list'],
    },
    {
      code: 'users:write',
      name: 'Write Users',
      description: 'Create and update users',
      resource: 'users',
      actions: ['create', 'update'],
    },
    {
      code: 'users:delete',
      name: 'Delete Users',
      description: 'Delete users',
      resource: 'users',
      actions: ['delete'],
    },

    // Organization permissions
    {
      code: 'organizations:read',
      name: 'Read Organizations',
      description: 'View organization information',
      resource: 'organizations',
      actions: ['read', 'list'],
    },
    {
      code: 'organizations:write',
      name: 'Write Organizations',
      description: 'Create and update organizations',
      resource: 'organizations',
      actions: ['create', 'update'],
    },
    {
      code: 'organizations:delete',
      name: 'Delete Organizations',
      description: 'Delete organizations',
      resource: 'organizations',
      actions: ['delete'],
    },

    // Audit permissions
    {
      code: 'audits:read',
      name: 'Read Audits',
      description: 'View audit information',
      resource: 'audits',
      actions: ['read', 'list'],
    },
    {
      code: 'audits:write',
      name: 'Write Audits',
      description: 'Create and update audits',
      resource: 'audits',
      actions: ['create', 'update'],
    },
    {
      code: 'audits:execute',
      name: 'Execute Audits',
      description: 'Execute audit procedures',
      resource: 'audits',
      actions: ['execute', 'approve'],
    },
    {
      code: 'audits:delete',
      name: 'Delete Audits',
      description: 'Delete audits',
      resource: 'audits',
      actions: ['delete'],
    },

    // Policy permissions
    {
      code: 'policies:read',
      name: 'Read Policies',
      description: 'View policy information',
      resource: 'policies',
      actions: ['read', 'list'],
    },
    {
      code: 'policies:write',
      name: 'Write Policies',
      description: 'Create and update policies',
      resource: 'policies',
      actions: ['create', 'update'],
    },
    {
      code: 'policies:approve',
      name: 'Approve Policies',
      description: 'Approve policy changes',
      resource: 'policies',
      actions: ['approve', 'reject'],
    },
    {
      code: 'policies:delete',
      name: 'Delete Policies',
      description: 'Delete policies',
      resource: 'policies',
      actions: ['delete'],
    },

    // Evidence permissions
    {
      code: 'evidence:read',
      name: 'Read Evidence',
      description: 'View evidence',
      resource: 'evidence',
      actions: ['read', 'list', 'download'],
    },
    {
      code: 'evidence:write',
      name: 'Write Evidence',
      description: 'Upload and update evidence',
      resource: 'evidence',
      actions: ['create', 'update', 'upload'],
    },
    {
      code: 'evidence:collect',
      name: 'Collect Evidence',
      description: 'Run evidence collection jobs',
      resource: 'evidence',
      actions: ['collect', 'schedule'],
    },
    {
      code: 'evidence:delete',
      name: 'Delete Evidence',
      description: 'Delete evidence',
      resource: 'evidence',
      actions: ['delete'],
    },

    // Report permissions
    {
      code: 'reports:read',
      name: 'Read Reports',
      description: 'View reports',
      resource: 'reports',
      actions: ['read', 'list', 'download'],
    },
    {
      code: 'reports:generate',
      name: 'Generate Reports',
      description: 'Generate new reports',
      resource: 'reports',
      actions: ['generate', 'schedule'],
    },
    {
      code: 'reports:delete',
      name: 'Delete Reports',
      description: 'Delete reports',
      resource: 'reports',
      actions: ['delete'],
    },

    // Workflow permissions
    {
      code: 'workflows:read',
      name: 'Read Workflows',
      description: 'View workflow information',
      resource: 'workflows',
      actions: ['read', 'list'],
    },
    {
      code: 'workflows:write',
      name: 'Write Workflows',
      description: 'Create and update workflows',
      resource: 'workflows',
      actions: ['create', 'update'],
    },
    {
      code: 'workflows:execute',
      name: 'Execute Workflows',
      description: 'Start and manage workflow instances',
      resource: 'workflows',
      actions: ['execute', 'pause', 'resume', 'cancel'],
    },
  ];

  // Create permissions
  const createdPermissions = [];
  for (const permData of permissions) {
    const existing = await permissionRepository.findOne({
      where: { code: permData.code },
    });

    if (!existing) {
      const permission = permissionRepository.create(permData);
      createdPermissions.push(await permissionRepository.save(permission));
    } else {
      createdPermissions.push(existing);
    }
  }

  // Create roles
  const roles = [
    {
      name: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Full system access',
      isSystem: true,
      permissions: ['admin:all'],
    },
    {
      name: 'msp_admin',
      displayName: 'MSP Administrator',
      description: 'MSP organization administrator',
      isSystem: true,
      permissions: [
        'organizations:read',
        'organizations:write',
        'users:read',
        'users:write',
        'audits:read',
        'audits:write',
        'audits:execute',
        'policies:read',
        'policies:write',
        'policies:approve',
        'evidence:read',
        'evidence:write',
        'evidence:collect',
        'reports:read',
        'reports:generate',
        'workflows:read',
        'workflows:write',
        'workflows:execute',
      ],
    },
    {
      name: 'cpa_partner',
      displayName: 'CPA Partner',
      description: 'CPA firm partner with audit privileges',
      isSystem: true,
      permissions: [
        'organizations:read',
        'audits:read',
        'audits:write',
        'audits:execute',
        'policies:read',
        'policies:approve',
        'evidence:read',
        'evidence:write',
        'reports:read',
        'reports:generate',
        'workflows:read',
        'workflows:execute',
      ],
    },
    {
      name: 'auditor',
      displayName: 'Auditor',
      description: 'Auditor with read and execute privileges',
      isSystem: true,
      permissions: [
        'audits:read',
        'audits:execute',
        'policies:read',
        'evidence:read',
        'reports:read',
        'reports:generate',
        'workflows:read',
        'workflows:execute',
      ],
    },
    {
      name: 'compliance_manager',
      displayName: 'Compliance Manager',
      description: 'Manage policies and compliance activities',
      isSystem: true,
      permissions: [
        'policies:read',
        'policies:write',
        'policies:approve',
        'evidence:read',
        'evidence:write',
        'evidence:collect',
        'reports:read',
        'reports:generate',
        'workflows:read',
        'workflows:write',
        'workflows:execute',
      ],
    },
    {
      name: 'client_admin',
      displayName: 'Client Administrator',
      description: 'Client organization administrator',
      isSystem: true,
      permissions: [
        'users:read',
        'users:write',
        'policies:read',
        'evidence:read',
        'evidence:write',
        'reports:read',
      ],
    },
    {
      name: 'client_user',
      displayName: 'Client User',
      description: 'Basic client user with read access',
      isSystem: true,
      permissions: ['policies:read', 'evidence:read', 'reports:read'],
    },
  ];

  // Create roles and assign permissions
  for (const roleData of roles) {
    let role = await roleRepository.findOne({
      where: { name: roleData.name },
    });

    if (!role) {
      role = roleRepository.create({
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
        type: roleData.isSystem ? RoleType.SYSTEM : RoleType.CUSTOM,
      });
      role = await roleRepository.save(role);
    }

    // Assign permissions to role
    for (const permCode of roleData.permissions) {
      const permission = createdPermissions.find((p) => p.code === permCode);
      if (permission) {
        const existing = await rolePermissionRepository.findOne({
          where: { roleId: role.id, permissionId: permission.id },
        });

        if (!existing) {
          const rolePermission = rolePermissionRepository.create({
            roleId: role.id,
            permissionId: permission.id,
          });
          await rolePermissionRepository.save(rolePermission);
        }
      }
    }
  }

  console.log('✅ Roles and permissions seeded successfully');
}
