import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import {
  Organization,
  OrganizationStatus,
  OrganizationType,
  Permission,
  Permissions,
  Role,
  RolePermission,
  RoleType,
  SystemRoles,
  User,
  UserRole,
  UserStatus,
  UserType,
} from '../../modules/users/entities';

export async function seed(dataSource: DataSource): Promise<void> {
  const organizationRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(Permission);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const rolePermissionRepo = dataSource.getRepository(RolePermission);

  console.log('🌱 Starting seed process...');

  // Step 1: Create MSP Organization (Your company)
  console.log('Creating MSP organization...');
  const mspOrg = await organizationRepo.save({
    name: 'SOC Compliance Platform',
    legalName: 'SOC Compliance Solutions LLC',
    type: OrganizationType.MSP,
    status: OrganizationStatus.ACTIVE,
    website: 'https://overmatch.digital',
    settings: {
      features: ['all'],
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expirationDays: 90,
      },
      sessionTimeout: 3600000, // 1 hour
    },
  });

  // Step 2: Create sample client organizations
  console.log('Creating sample client organizations...');
  const techCorpOrg = await organizationRepo.save({
    name: 'TechCorp Industries',
    legalName: 'TechCorp Industries Inc.',
    type: OrganizationType.CLIENT,
    status: OrganizationStatus.ACTIVE,
    website: 'https://techcorp.example.com',
    industry: 'Technology',
    size: '201-500',
    billing: {
      plan: 'enterprise',
      seats: 25,
      billingEmail: 'billing@techcorp.example.com',
    },
  });

  const healthSystemsOrg = await organizationRepo.save({
    name: 'Regional Health Systems',
    legalName: 'Regional Health Systems LLC',
    type: OrganizationType.CLIENT,
    status: OrganizationStatus.ACTIVE,
    website: 'https://regionalhealthsystems.example.com',
    industry: 'Healthcare',
    size: '500+',
    billing: {
      plan: 'enterprise',
      seats: 50,
      billingEmail: 'billing@regionalhealthsystems.example.com',
    },
  });

  // Step 3: Create sample partner organization (CPA firm)
  console.log('Creating sample partner organization...');
  const cpaFirmOrg = await organizationRepo.save({
    name: 'Premier Audit Partners',
    legalName: 'Premier Audit Partners LLP',
    type: OrganizationType.PARTNER,
    status: OrganizationStatus.ACTIVE,
    website: 'https://premieraudit.example.com',
    industry: 'Professional Services',
    size: '51-200',
  });

  // Step 4: Create all permissions
  console.log('Creating permissions...');
  const permissionDefinitions = [
    // Organization Management
    {
      resource: 'organization',
      action: 'view',
      displayName: 'View Organizations',
      category: 'Organization Management',
    },
    {
      resource: 'organization',
      action: 'create',
      displayName: 'Create Organizations',
      category: 'Organization Management',
    },
    {
      resource: 'organization',
      action: 'update',
      displayName: 'Update Organizations',
      category: 'Organization Management',
    },
    {
      resource: 'organization',
      action: 'delete',
      displayName: 'Delete Organizations',
      category: 'Organization Management',
    },

    // User Management
    { resource: 'user', action: 'view', displayName: 'View Users', category: 'User Management' },
    {
      resource: 'user',
      action: 'create',
      displayName: 'Create Users',
      category: 'User Management',
    },
    {
      resource: 'user',
      action: 'update',
      displayName: 'Update Users',
      category: 'User Management',
    },
    {
      resource: 'user',
      action: 'delete',
      displayName: 'Delete Users',
      category: 'User Management',
    },
    {
      resource: 'user',
      action: 'invite',
      displayName: 'Invite Users',
      category: 'User Management',
    },
    {
      resource: 'user',
      action: 'suspend',
      displayName: 'Suspend Users',
      category: 'User Management',
    },

    // Role Management
    { resource: 'role', action: 'view', displayName: 'View Roles', category: 'Role Management' },
    {
      resource: 'role',
      action: 'create',
      displayName: 'Create Roles',
      category: 'Role Management',
    },
    {
      resource: 'role',
      action: 'update',
      displayName: 'Update Roles',
      category: 'Role Management',
    },
    {
      resource: 'role',
      action: 'delete',
      displayName: 'Delete Roles',
      category: 'Role Management',
    },
    {
      resource: 'role',
      action: 'assign',
      displayName: 'Assign Roles',
      category: 'Role Management',
    },

    // Client Management
    {
      resource: 'client',
      action: 'view',
      displayName: 'View Clients',
      category: 'Client Management',
    },
    {
      resource: 'client',
      action: 'create',
      displayName: 'Create Clients',
      category: 'Client Management',
    },
    {
      resource: 'client',
      action: 'update',
      displayName: 'Update Clients',
      category: 'Client Management',
    },
    {
      resource: 'client',
      action: 'delete',
      displayName: 'Delete Clients',
      category: 'Client Management',
    },

    // Audit Management
    { resource: 'audit', action: 'view', displayName: 'View Audits', category: 'Audit Management' },
    {
      resource: 'audit',
      action: 'create',
      displayName: 'Create Audits',
      category: 'Audit Management',
    },
    {
      resource: 'audit',
      action: 'update',
      displayName: 'Update Audits',
      category: 'Audit Management',
    },
    {
      resource: 'audit',
      action: 'delete',
      displayName: 'Delete Audits',
      category: 'Audit Management',
    },
    {
      resource: 'audit',
      action: 'execute',
      displayName: 'Execute Audits',
      category: 'Audit Management',
    },

    // Evidence Management
    {
      resource: 'evidence',
      action: 'view',
      displayName: 'View Evidence',
      category: 'Evidence Management',
    },
    {
      resource: 'evidence',
      action: 'create',
      displayName: 'Upload Evidence',
      category: 'Evidence Management',
    },
    {
      resource: 'evidence',
      action: 'update',
      displayName: 'Update Evidence',
      category: 'Evidence Management',
    },
    {
      resource: 'evidence',
      action: 'delete',
      displayName: 'Delete Evidence',
      category: 'Evidence Management',
    },
    {
      resource: 'evidence',
      action: 'approve',
      displayName: 'Approve Evidence',
      category: 'Evidence Management',
    },

    // Control Management
    {
      resource: 'control',
      action: 'view',
      displayName: 'View Controls',
      category: 'Control Management',
    },
    {
      resource: 'control',
      action: 'create',
      displayName: 'Create Controls',
      category: 'Control Management',
    },
    {
      resource: 'control',
      action: 'update',
      displayName: 'Update Controls',
      category: 'Control Management',
    },
    {
      resource: 'control',
      action: 'delete',
      displayName: 'Delete Controls',
      category: 'Control Management',
    },
    {
      resource: 'control',
      action: 'test',
      displayName: 'Test Controls',
      category: 'Control Management',
    },

    // Policy Management
    {
      resource: 'policy',
      action: 'view',
      displayName: 'View Policies',
      category: 'Policy Management',
    },
    {
      resource: 'policy',
      action: 'create',
      displayName: 'Create Policies',
      category: 'Policy Management',
    },
    {
      resource: 'policy',
      action: 'update',
      displayName: 'Update Policies',
      category: 'Policy Management',
    },
    {
      resource: 'policy',
      action: 'delete',
      displayName: 'Delete Policies',
      category: 'Policy Management',
    },
    {
      resource: 'policy',
      action: 'approve',
      displayName: 'Approve Policies',
      category: 'Policy Management',
    },

    // Risk Management
    { resource: 'risk', action: 'view', displayName: 'View Risks', category: 'Risk Management' },
    {
      resource: 'risk',
      action: 'create',
      displayName: 'Create Risks',
      category: 'Risk Management',
    },
    {
      resource: 'risk',
      action: 'update',
      displayName: 'Update Risks',
      category: 'Risk Management',
    },
    {
      resource: 'risk',
      action: 'delete',
      displayName: 'Delete Risks',
      category: 'Risk Management',
    },
    {
      resource: 'risk',
      action: 'assess',
      displayName: 'Assess Risks',
      category: 'Risk Management',
    },

    // Report Management
    {
      resource: 'report',
      action: 'view',
      displayName: 'View Reports',
      category: 'Report Management',
    },
    {
      resource: 'report',
      action: 'create',
      displayName: 'Create Reports',
      category: 'Report Management',
    },
    {
      resource: 'report',
      action: 'export',
      displayName: 'Export Reports',
      category: 'Report Management',
    },
    {
      resource: 'report',
      action: 'schedule',
      displayName: 'Schedule Reports',
      category: 'Report Management',
    },

    // Billing Management
    {
      resource: 'billing',
      action: 'view',
      displayName: 'View Billing',
      category: 'Billing Management',
    },
    {
      resource: 'billing',
      action: 'manage',
      displayName: 'Manage Billing',
      category: 'Billing Management',
    },
    {
      resource: 'billing',
      action: 'export',
      displayName: 'Export Billing',
      category: 'Billing Management',
    },

    // Integration Management
    {
      resource: 'integration',
      action: 'view',
      displayName: 'View Integrations',
      category: 'Integration Management',
    },
    {
      resource: 'integration',
      action: 'create',
      displayName: 'Create Integrations',
      category: 'Integration Management',
    },
    {
      resource: 'integration',
      action: 'update',
      displayName: 'Update Integrations',
      category: 'Integration Management',
    },
    {
      resource: 'integration',
      action: 'delete',
      displayName: 'Delete Integrations',
      category: 'Integration Management',
    },

    // Settings Management
    {
      resource: 'settings',
      action: 'view',
      displayName: 'View Settings',
      category: 'Settings Management',
    },
    {
      resource: 'settings',
      action: 'update',
      displayName: 'Update Settings',
      category: 'Settings Management',
    },

    // Analytics
    { resource: 'analytics', action: 'view', displayName: 'View Analytics', category: 'Analytics' },
    {
      resource: 'analytics',
      action: 'export',
      displayName: 'Export Analytics',
      category: 'Analytics',
    },

    // Audit Trail
    {
      resource: 'audit_trail',
      action: 'view',
      displayName: 'View Audit Trail',
      category: 'Audit Trail',
    },
    {
      resource: 'audit_trail',
      action: 'export',
      displayName: 'Export Audit Trail',
      category: 'Audit Trail',
    },
  ];

  const permissions = await Promise.all(
    permissionDefinitions.map((def) => permissionRepo.save(def))
  );

  // Step 5: Create system roles
  console.log('Creating system roles...');
  const roles = {
    // MSP Roles
    superAdmin: await roleRepo.save({
      name: SystemRoles.SUPER_ADMIN,
      displayName: 'Super Administrator',
      description: 'Full system access across all organizations',
      type: RoleType.SYSTEM,
      metadata: { color: '#FF0000', icon: 'shield-admin', priority: 1 },
    }),

    mspAdmin: await roleRepo.save({
      name: SystemRoles.MSP_ADMIN,
      displayName: 'MSP Administrator',
      description: 'Administrative access for MSP organization',
      type: RoleType.SYSTEM,
      organizationId: mspOrg.id,
      metadata: { color: '#FF6B6B', icon: 'shield', priority: 2 },
    }),

    mspAnalyst: await roleRepo.save({
      name: SystemRoles.MSP_ANALYST,
      displayName: 'MSP Analyst',
      description: 'Analyst access for MSP organization',
      type: RoleType.SYSTEM,
      organizationId: mspOrg.id,
      metadata: { color: '#4ECDC4', icon: 'chart-line', priority: 3 },
    }),

    // Client Roles
    clientAdmin: await roleRepo.save({
      name: SystemRoles.CLIENT_ADMIN,
      displayName: 'Client Administrator',
      description: 'Administrative access for client organization',
      type: RoleType.SYSTEM,
      metadata: { color: '#FFE66D', icon: 'building', priority: 4 },
    }),

    clientManager: await roleRepo.save({
      name: SystemRoles.CLIENT_MANAGER,
      displayName: 'Client Manager',
      description: 'Management access for client organization',
      type: RoleType.SYSTEM,
      metadata: { color: '#95E1D3', icon: 'users', priority: 5 },
    }),

    clientUser: await roleRepo.save({
      name: SystemRoles.CLIENT_USER,
      displayName: 'Client User',
      description: 'Standard user access for client organization',
      type: RoleType.SYSTEM,
      metadata: { color: '#A8E6CF', icon: 'user', priority: 6 },
    }),

    // Partner Roles
    partnerAdmin: await roleRepo.save({
      name: SystemRoles.PARTNER_ADMIN,
      displayName: 'Partner Administrator',
      description: 'Administrative access for partner organization',
      type: RoleType.SYSTEM,
      metadata: { color: '#C7CEEA', icon: 'handshake', priority: 7 },
    }),

    partnerAuditor: await roleRepo.save({
      name: SystemRoles.PARTNER_AUDITOR,
      displayName: 'Partner Auditor',
      description: 'Auditor access for partner organization',
      type: RoleType.SYSTEM,
      metadata: { color: '#FFDAB9', icon: 'clipboard-check', priority: 8 },
    }),
  };

  // Step 6: Assign permissions to roles
  console.log('Assigning permissions to roles...');

  // Super Admin gets all permissions
  await Promise.all(
    permissions.map((permission) =>
      rolePermissionRepo.save({
        roleId: roles.superAdmin.id,
        permissionId: permission.id,
      })
    )
  );

  // MSP Admin gets most permissions
  const mspAdminPermissions = permissions.filter(
    (p) => !['organization:delete', 'role:delete'].includes(`${p.resource}:${p.action}`)
  );
  await Promise.all(
    mspAdminPermissions.map((permission) =>
      rolePermissionRepo.save({
        roleId: roles.mspAdmin.id,
        permissionId: permission.id,
      })
    )
  );

  // Client Admin gets client-specific permissions
  const clientAdminPermissions = permissions.filter(
    (p) =>
      [
        'user',
        'client',
        'audit',
        'evidence',
        'control',
        'policy',
        'risk',
        'report',
        'analytics',
      ].includes(p.resource) && !['delete'].includes(p.action)
  );
  await Promise.all(
    clientAdminPermissions.map((permission) =>
      rolePermissionRepo.save({
        roleId: roles.clientAdmin.id,
        permissionId: permission.id,
      })
    )
  );

  // Step 7: Create default users
  console.log('Creating default users...');
  const defaultPassword = await bcrypt.hash('Admin@123!', 12);

  // Super Admin user
  const superAdminUser = await userRepo.save({
    email: 'admin@soc-compliance.com',
    password: defaultPassword,
    firstName: 'System',
    lastName: 'Administrator',
    status: UserStatus.ACTIVE,
    userType: UserType.INTERNAL,
    organizationId: mspOrg.id,
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await userRoleRepo.save({
    userId: superAdminUser.id,
    roleId: roles.superAdmin.id,
  });

  // MSP Admin user
  const mspAdminUser = await userRepo.save({
    email: 'msp.admin@soc-compliance.com',
    password: defaultPassword,
    firstName: 'MSP',
    lastName: 'Admin',
    status: UserStatus.ACTIVE,
    userType: UserType.INTERNAL,
    organizationId: mspOrg.id,
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await userRoleRepo.save({
    userId: mspAdminUser.id,
    roleId: roles.mspAdmin.id,
  });

  // Client Admin users
  const techCorpAdmin = await userRepo.save({
    email: 'admin@techcorp.example.com',
    password: defaultPassword,
    firstName: 'Tech',
    lastName: 'Admin',
    status: UserStatus.ACTIVE,
    userType: UserType.CLIENT,
    organizationId: techCorpOrg.id,
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await userRoleRepo.save({
    userId: techCorpAdmin.id,
    roleId: roles.clientAdmin.id,
  });

  const healthSystemsAdmin = await userRepo.save({
    email: 'admin@regionalhealthsystems.example.com',
    password: defaultPassword,
    firstName: 'Health',
    lastName: 'Admin',
    status: UserStatus.ACTIVE,
    userType: UserType.CLIENT,
    organizationId: healthSystemsOrg.id,
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await userRoleRepo.save({
    userId: healthSystemsAdmin.id,
    roleId: roles.clientAdmin.id,
  });

  // Partner Auditor user
  const partnerAuditor = await userRepo.save({
    email: 'auditor@premieraudit.example.com',
    password: defaultPassword,
    firstName: 'Premier',
    lastName: 'Auditor',
    status: UserStatus.ACTIVE,
    userType: UserType.PARTNER,
    organizationId: cpaFirmOrg.id,
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await userRoleRepo.save({
    userId: partnerAuditor.id,
    roleId: roles.partnerAuditor.id,
  });

  console.log('✅ Seed completed successfully!');
  console.log('\n📧 Default login credentials:');
  console.log('Super Admin: admin@soc-compliance.com / Admin@123!');
  console.log('MSP Admin: msp.admin@soc-compliance.com / Admin@123!');
  console.log('TechCorp Admin: admin@techcorp.example.com / Admin@123!');
  console.log('Health Systems Admin: admin@regionalhealthsystems.example.com / Admin@123!');
  console.log('Partner Auditor: auditor@premieraudit.example.com / Admin@123!');
}
