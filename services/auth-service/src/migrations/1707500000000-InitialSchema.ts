import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialSchema1707500000000 implements MigrationInterface {
  name = 'InitialSchema1707500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'password',
            type: 'varchar',
          },
          {
            name: 'firstName',
            type: 'varchar',
          },
          {
            name: 'lastName',
            type: 'varchar',
          },
          {
            name: 'role',
            type: 'varchar',
            default: "'user'",
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'mfaEnabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mfaSecret',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'emailVerified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'emailVerificationToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'passwordResetToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'passwordResetExpires',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'lastLogin',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USER_EMAIL',
        columnNames: ['email'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USER_ORGANIZATION',
        columnNames: ['organizationId'],
      })
    );

    // Create sessions table
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'token',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'refreshToken',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create index on sessions
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSION_USER',
        columnNames: ['userId'],
      })
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSION_TOKEN',
        columnNames: ['token'],
      })
    );

    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
          },
          {
            name: 'resource',
            type: 'varchar',
          },
          {
            name: 'resourceId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes on audit_logs
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_USER',
        columnNames: ['userId'],
      })
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_ACTION',
        columnNames: ['action'],
      })
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_AUDIT_CREATED',
        columnNames: ['createdAt'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_CREATED');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_ACTION');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_USER');
    await queryRunner.dropIndex('sessions', 'IDX_SESSION_TOKEN');
    await queryRunner.dropIndex('sessions', 'IDX_SESSION_USER');
    await queryRunner.dropIndex('users', 'IDX_USER_ORGANIZATION');
    await queryRunner.dropIndex('users', 'IDX_USER_EMAIL');

    // Drop tables
    await queryRunner.dropTable('audit_logs');
    await queryRunner.dropTable('sessions');
    await queryRunner.dropTable('users');
  }
}