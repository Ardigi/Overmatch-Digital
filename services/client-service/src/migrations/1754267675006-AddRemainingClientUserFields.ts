import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemainingClientUserFields1754267675006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add remaining missing fields to client_users table
    await queryRunner.query(`
            ALTER TABLE "client_users" 
            ADD COLUMN "invitationToken" character varying,
            ADD COLUMN "invitationExpiresAt" date,
            ADD COLUMN "deactivatedAt" date
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the added fields
    await queryRunner.query(`
            ALTER TABLE "client_users" 
            DROP COLUMN "invitationToken",
            DROP COLUMN "invitationExpiresAt",
            DROP COLUMN "deactivatedAt"
        `);
  }
}
