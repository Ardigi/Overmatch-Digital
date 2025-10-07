import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import {
  Organization,
  OrganizationStatus,
  OrganizationType,
  Permission,
  Permissions as PermissionCodes,
  Role,
  RolePermission,
  RoleType,
  SystemRoles,
  User,
  UserRole,
  UserStatus,
  UserType,
} from '../../modules/users/entities';

export class InitialSeed {
  constructor(private dataSource: DataSource) {}

  async run() {
    console.log('Starting initial seed...');

    // Create permissions
    const permissions = await this.createPermissions();

    // Create MSP organization (your company)
    const mspOrg = await this.createMSPOrganization();

    // Create system roles
    const roles = await this.createSystemRoles(mspOrg);

    // Assign permissions to roles
    await this.assignPermissionsToRoles(roles, permissions);

    // Create super admin user
    const superAdmin = await this.createSuperAdminUser(mspOrg);

    // Assign super admin role
    await this.assignRoleToUser(superAdmin, roles.get(SystemRoles.SUPER_ADMIN)!);

    // Create demo client organization
    const clientOrg = await this.createDemoClientOrganization();

    // Create demo users
    await this.createDemoUsers(mspOrg, clientOrg, roles);

    console.log('Initial seed completed successfully!');
  }

  private async createPermissions(): Promise<Map<string, Permission>> {
    const permissionMap = new Map<string, Permission>();
    const permissionRepo = this.dataSource.getRepository(Permission);

    const permissionData = [
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
      {
        resource: 'audit',
        action: 'view',
        displayName: 'View Audits',
        category: 'Audit Management',
      },
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
      {
        resource: 'analytics',
        action: 'view',
        displayName: 'View Analytics',
        category: 'Analytics',
      },
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

    for (const data of permissionData) {
      const existing = await permissionRepo.findOne({
        where: { resource: data.resource, action: data.action },
      });

      if (!existing) {
        const permission = permissionRepo.create(data);
        const saved = await permissionRepo.save(permission);
        permissionMap.set(`${data.resource}:${data.action}`, saved);
      } else {
        permissionMap.set(`${data.resource}:${data.action}`, existing);
      }
    }

    console.log(`Created/verified ${permissionMap.size} permissions`);
    return permissionMap;
  }

  private async createMSPOrganization(): Promise<Organization> {
    const orgRepo = this.dataSource.getRepository(Organization);

    const existing = await orgRepo.findOne({
      where: { type: OrganizationType.MSP },
    });

    if (existing) {
      console.log('MSP organization already exists');
      return existing;
    }

    const mspOrg = orgRepo.create({
      name: 'SOC Compliance Platform',
      legalName: 'SOC Compliance Solutions LLC',
      type: OrganizationType.MSP,
      status: OrganizationStatus.ACTIVE,
      website: 'https://overmatch.digital',
      industry: 'Cybersecurity',
      size: '51-200',
      address: {
        street1: '123 Security Lane',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      settings: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          expirationDays: 90,
        },
        sessionTimeout: 3600000, // 1 hour
        features: ['all'],
      },
    });

    const saved = await orgRepo.save(mspOrg);
    console.log('Created MSP organization');
    return saved;
  }

  private async createSystemRoles(mspOrg: Organization): Promise<Map<string, Role>> {
    const roleMap = new Map<string, Role>();
    const roleRepo = this.dataSource.getRepository(Role);

    const roleData = [
      // MSP Roles
      {
        name: SystemRoles.SUPER_ADMIN,
        displayName: 'Super Administrator',
        description: 'Full system access with all permissions',
        type: RoleType.SYSTEM,
        organizationId: null, // Global role
      },
      {
        name: SystemRoles.MSP_ADMIN,
        displayName: 'MSP Administrator',
        description: 'Administrator for the MSP organization',
        type: RoleType.SYSTEM,
        organizationId: mspOrg.id,
      },
      {
        name: SystemRoles.MSP_ANALYST,
        displayName: 'MSP Analyst',
        description: 'Analyst for conducting audits and assessments',
        type: RoleType.SYSTEM,
        organizationId: mspOrg.id,
      },
      {
        name: SystemRoles.MSP_SUPPORT,
        displayName: 'MSP Support',
        description: 'Support staff for assisting clients',
        type: RoleType.SYSTEM,
        organizationId: mspOrg.id,
      },

      // Client Roles
      {
        name: SystemRoles.CLIENT_ADMIN,
        displayName: 'Client Administrator',
        description: 'Administrator for a client organization',
        type: RoleType.SYSTEM,
        organizationId: null, // Template role
      },
      {
        name: SystemRoles.CLIENT_MANAGER,
        displayName: 'Client Manager',
        description: 'Manager with elevated permissions in client organization',
        type: RoleType.SYSTEM,
        organizationId: null,
      },
      {
        name: SystemRoles.CLIENT_USER,
        displayName: 'Client User',
        description: 'Standard user in client organization',
        type: RoleType.SYSTEM,
        organizationId: null,
      },
      {
        name: SystemRoles.CLIENT_VIEWER,
        displayName: 'Client Viewer',
        description: 'Read-only access in client organization',
        type: RoleType.SYSTEM,
        organizationId: null,
      },

      // Partner Roles
      {
        name: SystemRoles.PARTNER_ADMIN,
        displayName: 'Partner Administrator',
        description: 'Administrator for a CPA partner firm',
        type: RoleType.SYSTEM,
        organizationId: null,
      },
      {
        name: SystemRoles.PARTNER_AUDITOR,
        displayName: 'Partner Auditor',
        description: 'Auditor from a CPA partner firm',
        type: RoleType.SYSTEM,
        organizationId: null,
      },
      {
        name: SystemRoles.PARTNER_REVIEWER,
        displayName: 'Partner Reviewer',
        description: 'Reviewer from a CPA partner firm',
        type: RoleType.SYSTEM,
        organizationId: null,
      },

      // External Auditor
      {
        name: SystemRoles.EXTERNAL_AUDITOR,
        displayName: 'External Auditor',
        description: 'External auditor with limited access',
        type: RoleType.SYSTEM,
        organizationId: null,
      },
    ];

    for (const data of roleData) {
      const existing = await roleRepo.findOne({
        where: { name: data.name },
      });

      if (!existing) {
        const role = roleRepo.create({
          ...data,
          metadata: {
            color: this.getRoleColor(data.name),
            icon: this.getRoleIcon(data.name),
            priority: this.getRolePriority(data.name),
          },
        });
        const saved = await roleRepo.save(role);
        roleMap.set(data.name, saved);
      } else {
        roleMap.set(data.name, existing);
      }
    }

    console.log(`Created/verified ${roleMap.size} roles`);
    return roleMap;
  }

  private async assignPermissionsToRoles(
    roles: Map<string, Role>,
    permissions: Map<string, Permission>
  ): Promise<void> {
    const rolePermissionRepo = this.dataSource.getRepository(RolePermission);

    const rolePermissionMap = {
      [SystemRoles.SUPER_ADMIN]: Array.from(permissions.keys()), // All permissions

      [SystemRoles.MSP_ADMIN]: [
        // All permissions except system settings
        ...Array.from(permissions.keys()).filter((p) => !p.startsWith('settings:')),
      ],

      [SystemRoles.MSP_ANALYST]: [
        'organization:view',
        'user:view',
        'client:view',
        'client:update',
        'audit:view',
        'audit:create',
        'audit:update',
        'audit:execute',
        'evidence:view',
        'evidence:create',
        'evidence:update',
        'evidence:approve',
        'control:view',
        'control:update',
        'control:test',
        'policy:view',
        'risk:view',
        'risk:create',
        'risk:update',
        'risk:assess',
        'report:view',
        'report:create',
        'report:export',
        'analytics:view',
        'audit_trail:view',
      ],

      [SystemRoles.MSP_SUPPORT]: [
        'organization:view',
        'user:view',
        'client:view',
        'audit:view',
        'evidence:view',
        'control:view',
        'policy:view',
        'risk:view',
        'report:view',
        'analytics:view',
      ],

      [SystemRoles.CLIENT_ADMIN]: [
        'user:view',
        'user:create',
        'user:update',
        'user:invite',
        'role:view',
        'role:assign',
        'audit:view',
        'evidence:view',
        'evidence:create',
        'evidence:update',
        'control:view',
        'policy:view',
        'policy:approve',
        'risk:view',
        'report:view',
        'report:export',
        'billing:view',
        'integration:view',
        'integration:create',
        'integration:update',
        'settings:view',
        'settings:update',
        'analytics:view',
        'audit_trail:view',
      ],

      [SystemRoles.CLIENT_MANAGER]: [
        'user:view',
        'audit:view',
        'evidence:view',
        'evidence:create',
        'evidence:update',
        'control:view',
        'policy:view',
        'risk:view',
        'risk:update',
        'report:view',
        'analytics:view',
        'audit_trail:view',
      ],

      [SystemRoles.CLIENT_USER]: [
        'audit:view',
        'evidence:view',
        'evidence:create',
        'control:view',
        'policy:view',
        'risk:view',
        'report:view',
      ],

      [SystemRoles.CLIENT_VIEWER]: [
        'audit:view',
        'evidence:view',
        'control:view',
        'policy:view',
        'risk:view',
        'report:view',
      ],

      [SystemRoles.PARTNER_ADMIN]: [
        'organization:view',
        'user:view',
        'client:view',
        'audit:view',
        'audit:update',
        'audit:execute',
        'evidence:view',
        'evidence:approve',
        'control:view',
        'control:test',
        'policy:view',
        'risk:view',
        'risk:assess',
        'report:view',
        'report:create',
        'report:export',
        'analytics:view',
        'audit_trail:view',
      ],

      [SystemRoles.PARTNER_AUDITOR]: [
        'client:view',
        'audit:view',
        'audit:execute',
        'evidence:view',
        'evidence:approve',
        'control:view',
        'control:test',
        'policy:view',
        'risk:view',
        'risk:assess',
        'report:view',
        'audit_trail:view',
      ],

      [SystemRoles.PARTNER_REVIEWER]: [
        'client:view',
        'audit:view',
        'evidence:view',
        'control:view',
        'policy:view',
        'risk:view',
        'report:view',
        'audit_trail:view',
      ],

      [SystemRoles.EXTERNAL_AUDITOR]: [
        'audit:view',
        'evidence:view',
        'control:view',
        'policy:view',
        'report:view',
      ],
    };

    for (const [roleName, permissionCodes] of Object.entries(rolePermissionMap)) {
      const role = roles.get(roleName);
      if (!role) continue;

      for (const permissionCode of permissionCodes) {
        const permission = permissions.get(permissionCode);
        if (!permission) continue;

        const existing = await rolePermissionRepo.findOne({
          where: { roleId: role.id, permissionId: permission.id },
        });

        if (!existing) {
          const rolePermission = rolePermissionRepo.create({
            roleId: role.id,
            permissionId: permission.id,
          });
          await rolePermissionRepo.save(rolePermission);
        }
      }
    }

    console.log('Assigned permissions to roles');
  }

  private async createSuperAdminUser(organization: Organization): Promise<User> {
    const userRepo = this.dataSource.getRepository(User);

    const existing = await userRepo.findOne({
      where: { email: 'admin@soc-compliance.com' },
    });

    if (existing) {
      console.log('Super admin user already exists');
      return existing;
    }

    const hashedPassword = await bcrypt.hash('Admin@123!', 12);

    const superAdmin = userRepo.create({
      email: 'admin@soc-compliance.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      status: UserStatus.ACTIVE,
      userType: UserType.INTERNAL,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      organizationId: organization.id,
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          inApp: true,
          sms: false,
        },
        timezone: 'America/Chicago',
        language: 'en',
      },
    });

    const saved = await userRepo.save(superAdmin);
    console.log('Created super admin user (admin@soc-compliance.com / Admin@123!)');
    return saved;
  }

  private async createDemoClientOrganization(): Promise<Organization> {
    const orgRepo = this.dataSource.getRepository(Organization);

    const existing = await orgRepo.findOne({
      where: { name: 'Acme Corporation' },
    });

    if (existing) {
      console.log('Demo client organization already exists');
      return existing;
    }

    const clientOrg = orgRepo.create({
      name: 'Acme Corporation',
      legalName: 'Acme Corporation Inc.',
      type: OrganizationType.CLIENT,
      status: OrganizationStatus.ACTIVE,
      website: 'https://acme.example.com',
      industry: 'Technology',
      size: '201-500',
      address: {
        street1: '456 Business Blvd',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'USA',
      },
      settings: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          expirationDays: 90,
        },
        sessionTimeout: 1800000, // 30 minutes
      },
      billing: {
        plan: 'enterprise',
        planStartDate: new Date(),
        planEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        seats: 50,
        billingEmail: 'billing@acme.example.com',
      },
    });

    const saved = await orgRepo.save(clientOrg);
    console.log('Created demo client organization');
    return saved;
  }

  private async createDemoUsers(
    mspOrg: Organization,
    clientOrg: Organization,
    roles: Map<string, Role>
  ): Promise<void> {
    const userRepo = this.dataSource.getRepository(User);

    const demoUsers = [
      // MSP Users
      {
        email: 'analyst@overmatch.digital',
        password: 'Analyst@123!',
        firstName: 'Sarah',
        lastName: 'Johnson',
        organizationId: mspOrg.id,
        userType: UserType.INTERNAL,
        role: SystemRoles.MSP_ANALYST,
        title: 'Senior Security Analyst',
      },
      {
        email: 'support@overmatch.digital',
        password: 'Support@123!',
        firstName: 'Mike',
        lastName: 'Wilson',
        organizationId: mspOrg.id,
        userType: UserType.INTERNAL,
        role: SystemRoles.MSP_SUPPORT,
        title: 'Customer Success Manager',
      },

      // Client Users
      {
        email: 'admin@acme.example.com',
        password: 'ClientAdmin@123!',
        firstName: 'John',
        lastName: 'Smith',
        organizationId: clientOrg.id,
        userType: UserType.CLIENT,
        role: SystemRoles.CLIENT_ADMIN,
        title: 'IT Director',
      },
      {
        email: 'manager@acme.example.com',
        password: 'Manager@123!',
        firstName: 'Emily',
        lastName: 'Davis',
        organizationId: clientOrg.id,
        userType: UserType.CLIENT,
        role: SystemRoles.CLIENT_MANAGER,
        title: 'Compliance Manager',
      },
      {
        email: 'user@acme.example.com',
        password: 'User@123!',
        firstName: 'Robert',
        lastName: 'Brown',
        organizationId: clientOrg.id,
        userType: UserType.CLIENT,
        role: SystemRoles.CLIENT_USER,
        title: 'Security Engineer',
      },
    ];

    for (const userData of demoUsers) {
      const existing = await userRepo.findOne({
        where: { email: userData.email },
      });

      if (!existing) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const user = userRepo.create({
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          title: userData.title,
          organizationId: userData.organizationId,
          userType: userData.userType,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        });

        const savedUser = await userRepo.save(user);

        // Assign role
        const role = roles.get(userData.role);
        if (role) {
          await this.assignRoleToUser(savedUser, role);
        }

        console.log(`Created demo user: ${userData.email} / ${userData.password}`);
      }
    }
  }

  private async assignRoleToUser(user: User, role: Role): Promise<void> {
    const userRoleRepo = this.dataSource.getRepository(UserRole);

    const existing = await userRoleRepo.findOne({
      where: { userId: user.id, roleId: role.id },
    });

    if (!existing) {
      const userRole = userRoleRepo.create({
        userId: user.id,
        roleId: role.id,
        grantedBy: user.id, // Self-assigned during seed
      });
      await userRoleRepo.save(userRole);
    }
  }

  private getRoleColor(roleName: string): string {
    const colorMap = {
      [SystemRoles.SUPER_ADMIN]: '#FF0000',
      [SystemRoles.MSP_ADMIN]: '#FF6B6B',
      [SystemRoles.MSP_ANALYST]: '#4ECDC4',
      [SystemRoles.MSP_SUPPORT]: '#45B7D1',
      [SystemRoles.CLIENT_ADMIN]: '#6C5CE7',
      [SystemRoles.CLIENT_MANAGER]: '#A29BFE',
      [SystemRoles.CLIENT_USER]: '#74B9FF',
      [SystemRoles.CLIENT_VIEWER]: '#81ECEC',
      [SystemRoles.PARTNER_ADMIN]: '#FDCB6E',
      [SystemRoles.PARTNER_AUDITOR]: '#F9CA24',
      [SystemRoles.PARTNER_REVIEWER]: '#F0932B',
      [SystemRoles.EXTERNAL_AUDITOR]: '#95A5A6',
    };
    return colorMap[roleName] || '#636E72';
  }

  private getRoleIcon(roleName: string): string {
    const iconMap = {
      [SystemRoles.SUPER_ADMIN]: 'shield-star',
      [SystemRoles.MSP_ADMIN]: 'shield-check',
      [SystemRoles.MSP_ANALYST]: 'chart-line',
      [SystemRoles.MSP_SUPPORT]: 'headset',
      [SystemRoles.CLIENT_ADMIN]: 'building-shield',
      [SystemRoles.CLIENT_MANAGER]: 'user-tie',
      [SystemRoles.CLIENT_USER]: 'user',
      [SystemRoles.CLIENT_VIEWER]: 'eye',
      [SystemRoles.PARTNER_ADMIN]: 'handshake',
      [SystemRoles.PARTNER_AUDITOR]: 'clipboard-check',
      [SystemRoles.PARTNER_REVIEWER]: 'search',
      [SystemRoles.EXTERNAL_AUDITOR]: 'user-check',
    };
    return iconMap[roleName] || 'user';
  }

  private getRolePriority(roleName: string): number {
    const priorityMap = {
      [SystemRoles.SUPER_ADMIN]: 1,
      [SystemRoles.MSP_ADMIN]: 2,
      [SystemRoles.MSP_ANALYST]: 3,
      [SystemRoles.MSP_SUPPORT]: 4,
      [SystemRoles.PARTNER_ADMIN]: 5,
      [SystemRoles.PARTNER_AUDITOR]: 6,
      [SystemRoles.PARTNER_REVIEWER]: 7,
      [SystemRoles.CLIENT_ADMIN]: 8,
      [SystemRoles.CLIENT_MANAGER]: 9,
      [SystemRoles.CLIENT_USER]: 10,
      [SystemRoles.CLIENT_VIEWER]: 11,
      [SystemRoles.EXTERNAL_AUDITOR]: 12,
    };
    return priorityMap[roleName] || 99;
  }
}
