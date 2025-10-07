import type { DataSource } from 'typeorm';
import { TestDataBuilder } from './TestDataBuilder';

export class DatabaseHelper {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Clean all data from database
   */
  async cleanDatabase(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Disable foreign key checks
      await queryRunner.query('SET session_replication_role = replica;');

      // Get all tables
      const tables = await queryRunner.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'typeorm_%'
        AND tablename NOT LIKE 'migrations'
      `);

      // Truncate all tables
      for (const { tablename } of tables) {
        await queryRunner.query(`TRUNCATE TABLE "${tablename}" CASCADE`);
      }

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Seed basic test data
   */
  async seedBasicData(): Promise<{
    organization: any;
    adminUser: any;
    regularUser: any;
    framework: any;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Create organization
      const organization = TestDataBuilder.createTestOrganization({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Test Organization',
        domain: 'test.soc',
      });

      await queryRunner.query(
        `INSERT INTO organizations (id, name, domain, industry, size, tier, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          organization.id,
          organization.name,
          organization.domain,
          organization.industry,
          organization.size,
          organization.tier,
          organization.createdAt,
          organization.updatedAt,
        ]
      );

      // Create admin user
      const adminUser = TestDataBuilder.createTestUser({
        id: '22222222-2222-2222-2222-222222222222',
        email: 'admin@test.soc',
        firstName: 'Admin',
        lastName: 'User',
        isEmailVerified: true,
      });
      const adminPassword = await TestDataBuilder.createHashedPassword('Admin123!@#');

      await queryRunner.query(
        `INSERT INTO users (id, email, password, "firstName", "lastName", "isEmailVerified", "mfaEnabled", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          adminUser.id,
          adminUser.email,
          adminPassword,
          adminUser.firstName,
          adminUser.lastName,
          adminUser.isEmailVerified,
          adminUser.mfaEnabled,
          adminUser.createdAt,
          adminUser.updatedAt,
        ]
      );

      // Create regular user
      const regularUser = TestDataBuilder.createTestUser({
        id: '33333333-3333-3333-3333-333333333333',
        email: 'user@test.soc',
        firstName: 'Regular',
        lastName: 'User',
        isEmailVerified: true,
      });
      const userPassword = await TestDataBuilder.createHashedPassword('User123!@#');

      await queryRunner.query(
        `INSERT INTO users (id, email, password, "firstName", "lastName", "isEmailVerified", "mfaEnabled", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          regularUser.id,
          regularUser.email,
          userPassword,
          regularUser.firstName,
          regularUser.lastName,
          regularUser.isEmailVerified,
          regularUser.mfaEnabled,
          regularUser.createdAt,
          regularUser.updatedAt,
        ]
      );

      // Create user-organization relationships
      await queryRunner.query(
        `INSERT INTO user_organizations (id, "userId", "organizationId", role, permissions, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("userId", "organizationId") DO NOTHING`,
        [
          '44444444-4444-4444-4444-444444444444',
          adminUser.id,
          organization.id,
          'admin',
          JSON.stringify(['*']),
          new Date(),
          new Date(),
        ]
      );

      await queryRunner.query(
        `INSERT INTO user_organizations (id, "userId", "organizationId", role, permissions, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("userId", "organizationId") DO NOTHING`,
        [
          '55555555-5555-5555-5555-555555555555',
          regularUser.id,
          organization.id,
          'member',
          JSON.stringify(['read:*', 'write:evidence']),
          new Date(),
          new Date(),
        ]
      );

      // Create framework
      const framework = TestDataBuilder.createTestFramework({
        id: '66666666-6666-6666-6666-666666666666',
        name: 'SOC 2 Type II',
        version: '2017',
      });

      await queryRunner.query(
        `INSERT INTO frameworks (id, name, version, description, "isActive", metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          framework.id,
          framework.name,
          framework.version,
          framework.description,
          framework.isActive,
          JSON.stringify(framework.metadata),
          framework.createdAt,
          framework.updatedAt,
        ]
      );

      return {
        organization,
        adminUser: { ...adminUser, password: 'Admin123!@#' },
        regularUser: { ...regularUser, password: 'User123!@#' },
        framework,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Seed complete test scenario
   */
  async seedCompleteTestScenario(): Promise<any> {
    const data = await TestDataBuilder.createCompleteTestScenario();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Insert all test data
      // Organization
      await queryRunner.query(
        `INSERT INTO organizations (id, name, domain, industry, size, tier, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        Object.values(data.organization)
      );

      // User
      await queryRunner.query(
        `INSERT INTO users (id, email, password, "firstName", "lastName", "isEmailVerified", "mfaEnabled", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.user.id,
          data.user.email,
          data.user.password,
          data.user.firstName,
          data.user.lastName,
          data.user.isEmailVerified,
          data.user.mfaEnabled,
          data.user.createdAt,
          data.user.updatedAt,
        ]
      );

      // Framework
      await queryRunner.query(
        `INSERT INTO frameworks (id, name, version, description, "isActive", metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.framework.id,
          data.framework.name,
          data.framework.version,
          data.framework.description,
          data.framework.isActive,
          JSON.stringify(data.framework.metadata),
          data.framework.createdAt,
          data.framework.updatedAt,
        ]
      );

      // Add more entities as needed...

      return data;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute raw SQL query
   */
  async executeQuery(sql: string, parameters?: any[]): Promise<any> {
    return this.dataSource.query(sql, parameters);
  }

  /**
   * Get entity repository
   */
  getRepository<T>(entityName: string) {
    return this.dataSource.getRepository<T>(entityName);
  }

  /**
   * Wait for specific data to appear in database
   */
  async waitForData(
    tableName: string,
    condition: string,
    parameters: any[] = [],
    maxRetries = 30,
    delayMs = 1000
  ): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      const result = await this.dataSource.query(
        `SELECT * FROM "${tableName}" WHERE ${condition}`,
        parameters
      );

      if (result.length > 0) {
        return result[0];
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`Data not found in ${tableName} after ${maxRetries} attempts`);
  }

  /**
   * Verify data exists
   */
  async verifyDataExists(
    tableName: string,
    condition: string,
    parameters: any[] = []
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${condition}`,
      parameters
    );

    return result[0].count > 0;
  }

  /**
   * Get row count for a table
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.dataSource.query(`SELECT COUNT(*) as count FROM "${tableName}"`);

    return parseInt(result[0].count, 10);
  }
}
