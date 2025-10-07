/**
 * REAL Database Integration Test - Auth Service
 * 
 * This test validates actual database connectivity and authentication operations.
 * Tests will FAIL if database is not available - no mocks or fallbacks.
 * 
 * Prerequisites:
 * - PostgreSQL must be running with test database
 * - Database migrations must be applied
 * - Connection credentials must be correct
 */

/**
 * NOTE: This test file REQUIRES the jest.config.integration.js config to run properly
 * Run with: npx jest --config jest.config.integration.js **/*.integration.spec.ts
 *
 * The integration config disables TypeORM mocking to allow real database connections.
 */

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Organization, OrganizationStatus, OrganizationType } from '../../users/entities/organization.entity';
import { Permission } from '../../users/entities/permission.entity';
import { Role } from '../../users/entities/role.entity';
import { User, UserStatus, UserType } from '../../users/entities/user.entity';
import { LoginEvent } from '../entities/login-event.entity';

describe('Auth Database Integration (REAL)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let organizationRepository: Repository<Organization>;
  let loginEventRepository: Repository<LoginEvent>;
  let roleRepository: Repository<Role>;
  let permissionRepository: Repository<Permission>;

  const TEST_ORG_ID = 'test-org-' + uuidv4();
  const TEST_USER_ID = 'test-user-' + uuidv4();

  // Helper function to execute raw SQL queries
  const executeQuery = async (query: string, parameters?: any[]) => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not initialized');
    }
    const queryRunner = dataSource.createQueryRunner();
    if (!queryRunner) {
      throw new Error('Failed to create query runner');
    }
    try {
      return await queryRunner.query(query, parameters);
    } finally {
      if (queryRunner && queryRunner.release) {
        await queryRunner.release();
      }
    }
  };

  beforeAll(async () => {
    // CRITICAL: Test must fail if database is unavailable
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_auth',  // Use soc_auth not soc_auth_test
      entities: [User, Organization, LoginEvent, Role, Permission],
      synchronize: false, // Use actual migrations
      logging: false,
    });

    try {
      await dataSource.initialize();
      console.log('DataSource initialized successfully');
      console.log('Is initialized:', dataSource.isInitialized);
    } catch (error) {
      throw new Error(
        `Database connection failed: ${error.message}. ` +
        'Integration tests require actual database connectivity. ' +
        'Start database with: docker-compose up postgres'
      );
    }

    // Get repositories
    userRepository = dataSource.getRepository(User);
    organizationRepository = dataSource.getRepository(Organization);
    loginEventRepository = dataSource.getRepository(LoginEvent);
    roleRepository = dataSource.getRepository(Role);
    permissionRepository = dataSource.getRepository(Permission);

    // Verify database is connected but skip table verification in beforeAll
    // Table verification will be done in the actual tests
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await (global as any).cleanupTestData(dataSource, TEST_ORG_ID);
  });

  describe('Database Connectivity Requirements', () => {
    it('should require active database connection', async () => {
      // Verify database is actually connected
      expect(dataSource.isInitialized).toBe(true);
      
      // Test actual database query
      const result = await executeQuery('SELECT 1 as test');
      expect(result[0].test).toBe(1);
      
      // Verify database schema exists
      const tables = await executeQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tableNames = tables.map(t => t.table_name);
      
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('organizations');
      expect(tableNames).toContain('login_events');
      expect(tableNames).toContain('roles');
      expect(tableNames).toContain('permissions');
    });

    it('should have all required tables and columns', async () => {
      // Verify users table structure
      const userColumns = await executeQuery(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY column_name
      `);
      
      const columnNames = userColumns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password');
      expect(columnNames).toContain('organization_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('mfa_enabled');
      expect(columnNames).toContain('email_verified');
      expect(columnNames).toContain('created_at');
    });

    it('should enforce database constraints', async () => {
      // Test unique email constraint
      const org = organizationRepository.create({
        id: TEST_ORG_ID,
        name: 'Test Organization',
        type: OrganizationType.CLIENT,
        status: OrganizationStatus.ACTIVE,
      });
      await organizationRepository.save(org);

      const user1 = userRepository.create({
        email: 'duplicate@example.com',
        password: 'hashedpassword',
        firstName: 'User',
        lastName: 'One',
        organizationId: TEST_ORG_ID,
      });
      await userRepository.save(user1);

      const user2 = userRepository.create({
        email: 'duplicate@example.com', // Same email
        password: 'hashedpassword',
        firstName: 'User',
        lastName: 'Two',
        organizationId: TEST_ORG_ID,
      });

      await expect(
        userRepository.save(user2)
      ).rejects.toThrow();
    });
  });

  describe('Real Authentication Operations', () => {
    let testOrganization: Organization;
    let testUser: User;

    beforeEach(async () => {
      // Create test organization
      testOrganization = organizationRepository.create({
        id: TEST_ORG_ID,
        name: 'Integration Test Organization',
        legalName: 'Integration Test Organization LLC',
        type: OrganizationType.CLIENT,
        status: OrganizationStatus.ACTIVE,
        industry: 'Technology',
        size: '1-50',
        address: {
          street1: '123 Test Street',
          city: 'Test City',
          state: 'TC',
          postalCode: '12345',
          country: 'US',
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
          sessionTimeout: 3600,
          allowedIpRanges: ['192.168.0.0/16'],
        },
      });
      await organizationRepository.save(testOrganization);

      // Create test user with real password hashing
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      testUser = userRepository.create({
        id: TEST_USER_ID,
        email: 'test.user@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        title: 'Test Engineer',
        status: UserStatus.ACTIVE,
        userType: UserType.CLIENT,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        mfaEnabled: false,
        roles: ['user'],
        permissions: ['read:profile'],
        organizationId: TEST_ORG_ID,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            inApp: true,
            sms: false,
          },
          timezone: 'America/New_York',
          language: 'en',
        },
      });
      await userRepository.save(testUser);
    });

    it('should create, authenticate, and manage user lifecycle', async () => {
      // VERIFY USER CREATION
      const createdUser = await userRepository.findOne({
        where: { id: TEST_USER_ID },
        relations: ['organization'],
      });
      expect(createdUser).toBeDefined();
      expect(createdUser!.email).toBe('test.user@example.com');
      expect(createdUser!.organization.name).toBe('Integration Test Organization');
      expect(createdUser!.fullName).toBe('Test User');

      // TEST PASSWORD VERIFICATION (Real bcrypt)
      const isValidPassword = await bcrypt.compare('TestPassword123!', createdUser!.password);
      expect(isValidPassword).toBe(true);

      const isInvalidPassword = await bcrypt.compare('WrongPassword', createdUser!.password);
      expect(isInvalidPassword).toBe(false);

      // TEST LOGIN EVENT TRACKING
      const loginEvent = loginEventRepository.create({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: createdUser!.email,
        ipAddress: '192.168.1.100',
        userAgent: 'Integration Test Browser',
        success: true,
        attempt: 1,
        eventType: 'login',
        metadata: {
          location: 'Test City, TC',
          device: 'Desktop',
        },
      });
      await loginEventRepository.save(loginEvent);

      // Update user last login
      createdUser!.lastLoginAt = new Date();
      createdUser!.lastLoginIp = '192.168.1.100';
      await userRepository.save(createdUser!);

      // VERIFY LOGIN EVENT CREATED
      const savedLoginEvent = await loginEventRepository.findOne({
        where: { userId: TEST_USER_ID },
      });
      expect(savedLoginEvent).toBeDefined();
      expect(savedLoginEvent!.success).toBe(true);
      expect(savedLoginEvent!.ipAddress).toBe('192.168.1.100');

      // TEST FAILED LOGIN ATTEMPT TRACKING
      const failedLoginEvent = loginEventRepository.create({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: createdUser!.email,
        ipAddress: '192.168.1.100',
        userAgent: 'Integration Test Browser',
        success: false,
        attempt: 1,
        eventType: 'login_failed',
        failureReason: 'invalid_password',
      });
      await loginEventRepository.save(failedLoginEvent);

      // Increment failed login attempts
      createdUser!.failedLoginAttempts = 1;
      await userRepository.save(createdUser!);

      const failedEvent = await loginEventRepository.findOne({
        where: { success: false, userId: TEST_USER_ID },
      });
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.failureReason).toBe('invalid_password');

      // TEST ACCOUNT LOCKING
      createdUser!.failedLoginAttempts = 5;
      createdUser!.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await userRepository.save(createdUser!);

      const lockedUser = await userRepository.findOne({
        where: { id: TEST_USER_ID },
      });
      expect(lockedUser!.isLocked()).toBe(true);
      expect(lockedUser!.failedLoginAttempts).toBe(5);

      // TEST ACCOUNT UNLOCKING
      lockedUser!.failedLoginAttempts = 0;
      lockedUser!.lockedUntil = null;
      await userRepository.save(lockedUser!);

      const unlockedUser = await userRepository.findOne({
        where: { id: TEST_USER_ID },
      });
      expect(unlockedUser!.isLocked()).toBe(false);
    });

    it('should handle MFA setup and validation with real database', async () => {
      // Enable MFA for user
      const mfaSecret = 'JBSWY3DPEHPK3PXP'; // Base32 test secret
      const backupCodes = JSON.stringify(['123456', '789012', '345678']);

      testUser.mfaEnabled = true;
      testUser.mfaSecret = mfaSecret;
      testUser.mfaBackupCodes = backupCodes;
      await userRepository.save(testUser);

      // Verify MFA settings persisted
      const userWithMFA = await userRepository.findOne({
        where: { id: TEST_USER_ID },
      });
      expect(userWithMFA!.mfaEnabled).toBe(true);
      expect(userWithMFA!.mfaSecret).toBe(mfaSecret);
      expect(JSON.parse(userWithMFA!.mfaBackupCodes!)).toContain('123456');

      // Test MFA login event
      const mfaLoginEvent = loginEventRepository.create({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: userWithMFA!.email,
        ipAddress: '192.168.1.100',
        userAgent: 'Integration Test Browser',
        success: true,
        attempt: 1,
        eventType: 'mfa_login',
        metadata: {
          mfaMethod: 'totp',
        },
      });
      await loginEventRepository.save(mfaLoginEvent);

      const mfaEvent = await loginEventRepository.findOne({
        where: { eventType: 'mfa_login', userId: TEST_USER_ID },
      });
      expect(mfaEvent).toBeDefined();
      expect(mfaEvent!.metadata.mfaMethod).toBe('totp');
    });

    it('should handle password reset flow with database operations', async () => {
      // Generate reset token
      const resetToken = 'reset-token-' + uuidv4();
      const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      testUser.resetPasswordToken = resetToken;
      testUser.resetPasswordExpires = resetExpires;
      await userRepository.save(testUser);

      // Verify reset token stored
      const userWithResetToken = await userRepository.findOne({
        where: { resetPasswordToken: resetToken },
      });
      expect(userWithResetToken).toBeDefined();
      expect(userWithResetToken!.id).toBe(TEST_USER_ID);
      expect(userWithResetToken!.isResetTokenValid()).toBe(true);

      // Simulate password reset
      const newPassword = await bcrypt.hash('NewPassword456!', 10);
      userWithResetToken!.password = newPassword;
      userWithResetToken!.resetPasswordToken = null;
      userWithResetToken!.resetPasswordExpires = null;
      userWithResetToken!.passwordChangedAt = new Date();
      
      // Add old password to history
      if (!userWithResetToken!.previousPasswords) {
        userWithResetToken!.previousPasswords = [];
      }
      userWithResetToken!.previousPasswords.push(testUser.password);
      
      await userRepository.save(userWithResetToken!);

      // Verify password changed
      const userWithNewPassword = await userRepository.findOne({
        where: { id: TEST_USER_ID },
      });
      const isNewPasswordValid = await bcrypt.compare('NewPassword456!', userWithNewPassword!.password);
      expect(isNewPasswordValid).toBe(true);
      expect(userWithNewPassword!.passwordChangedAt).toBeDefined();
      expect(userWithNewPassword!.previousPasswords).toHaveLength(1);
      expect(userWithNewPassword!.isResetTokenValid()).toBe(false);
    });
  });

  describe('Complex Authentication Queries', () => {
    beforeEach(async () => {
      // Set up test data for complex queries
      const testOrg = organizationRepository.create({
        id: TEST_ORG_ID,
        name: 'Query Test Organization',
        type: OrganizationType.CLIENT,
        status: OrganizationStatus.ACTIVE,
      });
      await organizationRepository.save(testOrg);

      // Create multiple users and login events
      const users = [];
      const loginEvents = [];
      
      for (let i = 0; i < 10; i++) {
        const hashedPassword = await bcrypt.hash(`Password${i}!`, 10);
        const user = userRepository.create({
          email: `user${i}@example.com`,
          password: hashedPassword,
          firstName: `User`,
          lastName: `${i}`,
          status: i < 8 ? UserStatus.ACTIVE : UserStatus.INACTIVE,
          userType: UserType.CLIENT,
          emailVerified: i < 7,
          mfaEnabled: i < 3,
          organizationId: TEST_ORG_ID,
          lastLoginAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
          failedLoginAttempts: i % 3,
        });
        users.push(user);

        // Create login events
        loginEvents.push(loginEventRepository.create({
          userId: user.id,
          organizationId: TEST_ORG_ID,
          email: user.email,
          ipAddress: `192.168.1.${100 + i}`,
          userAgent: 'Test Browser',
          success: i % 4 !== 0, // Some failures
          attempt: 1,
          eventType: 'login',
          createdAt: new Date(Date.now() - (i * 12 * 60 * 60 * 1000)),
        }));
      }
      
      await userRepository.save(users);
      await loginEventRepository.save(loginEvents);
    });

    it('should perform complex user analytics queries', async () => {
      // Test query similar to AuthService.getUserStats
      const userStats = await userRepository
        .createQueryBuilder('user')
        .select('user.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('AVG(user.failedLoginAttempts)', 'avgFailedAttempts')
        .where('user.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .groupBy('user.status')
        .getRawMany();

      expect(userStats.length).toBeGreaterThan(0);
      
      userStats.forEach(stat => {
        expect(stat).toHaveProperty('status');
        expect(stat).toHaveProperty('count');
        expect(stat).toHaveProperty('avgFailedAttempts');
        expect(parseInt(stat.count)).toBeGreaterThan(0);
      });

      // Verify specific status counts
      const activeUsers = userStats.find(s => s.status === 'active');
      expect(activeUsers).toBeDefined();
      expect(parseInt(activeUsers!.count)).toBe(8);
    });

    it('should handle login analytics with date ranges', async () => {
      const startDate = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)); // 5 days ago
      const endDate = new Date();

      const loginStats = await loginEventRepository
        .createQueryBuilder('login')
        .select('login.success', 'success')
        .addSelect('COUNT(*)', 'count')
        .addSelect('DATE(login.createdAt)', 'date')
        .where('login.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .andWhere('login.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('login.success')
        .addGroupBy('DATE(login.createdAt)')
        .orderBy('DATE(login.createdAt)', 'DESC')
        .getRawMany();

      expect(loginStats.length).toBeGreaterThan(0);

      loginStats.forEach(stat => {
        expect(stat).toHaveProperty('success');
        expect(stat).toHaveProperty('count');
        expect(stat).toHaveProperty('date');
        expect(parseInt(stat.count)).toBeGreaterThan(0);
      });
    });

    it('should test full-text search on user profiles', async () => {
      // Test PostgreSQL ILIKE search (as used in UsersService)
      const searchTerm = 'User 5';
      const results = await userRepository
        .createQueryBuilder('user')
        .where('user.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .andWhere('(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)', 
          { search: `%${searchTerm}%` })
        .getMany();

      expect(results.length).toBe(1);
      expect(results[0].lastName).toBe('5');
    });

    it('should handle concurrent user authentication operations', async () => {
      // Test concurrent password updates (simulating real-world load)
      const concurrentOps = 5;
      const promises = [];

      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          (async () => {
            const user = await userRepository.findOne({
              where: { email: `user${i}@example.com` },
            });
            if (user) {
              const newPassword = await bcrypt.hash(`UpdatedPassword${i}!`, 10);
              user.password = newPassword;
              user.passwordChangedAt = new Date();
              return userRepository.save(user);
            }
          })()
        );
      }

      const results = await Promise.all(promises);
      expect(results.filter(r => r !== undefined)).toHaveLength(concurrentOps);

      // Verify all passwords were updated
      for (let i = 0; i < concurrentOps; i++) {
        const user = await userRepository.findOne({
          where: { email: `user${i}@example.com` },
        });
        const isPasswordUpdated = await bcrypt.compare(`UpdatedPassword${i}!`, user!.password);
        expect(isPasswordUpdated).toBe(true);
      }
    });
  });

  describe('Organization and Role Management', () => {
    it('should handle hierarchical organization structure', async () => {
      // Create parent organization (MSP)
      const mspOrg = organizationRepository.create({
        id: 'msp-' + uuidv4(),
        name: 'MSP Parent Organization',
        type: OrganizationType.MSP,
        status: OrganizationStatus.ACTIVE,
      });
      await organizationRepository.save(mspOrg);

      // Create child organization (Client)
      const clientOrg = organizationRepository.create({
        id: TEST_ORG_ID,
        name: 'Client Child Organization',
        type: OrganizationType.CLIENT,
        status: OrganizationStatus.ACTIVE,
        parentOrganizationId: mspOrg.id,
      });
      await organizationRepository.save(clientOrg);

      // Test hierarchical query
      const childOrgs = await organizationRepository.find({
        where: { parentOrganizationId: mspOrg.id },
        relations: ['parentOrganization'],
      });

      expect(childOrgs).toHaveLength(1);
      expect(childOrgs[0].name).toBe('Client Child Organization');
      expect(childOrgs[0].parentOrganization.name).toBe('MSP Parent Organization');
      expect(childOrgs[0].parentOrganization.isMSP()).toBe(true);
    });

    it('should handle role-based access control with database', async () => {
      // Create test organization
      const testOrg = organizationRepository.create({
        id: TEST_ORG_ID,
        name: 'RBAC Test Organization',
        type: OrganizationType.CLIENT,
        status: OrganizationStatus.ACTIVE,
      });
      await organizationRepository.save(testOrg);

      // Create permissions
      const readPermission = permissionRepository.create({
        name: 'read:users',
        description: 'Read user data',
        resource: 'user',
        action: 'read',
      });

      const writePermission = permissionRepository.create({
        name: 'write:users',
        description: 'Write user data',
        resource: 'user',
        action: 'write',
      });

      await permissionRepository.save([readPermission, writePermission]);

      // Create role with permissions
      const adminRole = roleRepository.create({
        name: 'admin',
        description: 'Administrator role',
        organizationId: TEST_ORG_ID,
        permissions: [readPermission.name, writePermission.name],
        isActive: true,
      });
      await roleRepository.save(adminRole);

      // Create user with role
      const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
      const adminUser = userRepository.create({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        organizationId: TEST_ORG_ID,
        roles: [adminRole.name],
        permissions: adminRole.permissions,
        status: UserStatus.ACTIVE,
      });
      await userRepository.save(adminUser);

      // Test role query
      const userWithRole = await userRepository.findOne({
        where: { id: adminUser.id },
        relations: ['organization'],
      });

      expect(userWithRole!.roles).toContain('admin');
      expect(userWithRole!.permissions).toContain('read:users');
      expect(userWithRole!.permissions).toContain('write:users');

      // Test role-based query
      const adminUsers = await userRepository.find({
        where: { organizationId: TEST_ORG_ID },
      });

      const usersWithAdminRole = adminUsers.filter(user => 
        user.roles && user.roles.includes('admin')
      );
      expect(usersWithAdminRole).toHaveLength(1);
    });
  });
});