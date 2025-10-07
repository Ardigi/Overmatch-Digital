import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingClientUserFields1754267619669 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing fields to client_users table
    await queryRunner.query(`
            ALTER TABLE "client_users" 
            ADD COLUMN "email" character varying,
            ADD COLUMN "firstName" character varying,
            ADD COLUMN "lastName" character varying,
            ADD COLUMN "phone" character varying
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the added fields
    await queryRunner.query(`
            ALTER TABLE "client_users" 
            DROP COLUMN "email",
            DROP COLUMN "firstName",
            DROP COLUMN "lastName",
            DROP COLUMN "phone"
        `);
  }
}
