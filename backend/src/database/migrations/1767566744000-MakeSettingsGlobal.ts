import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeSettingsGlobal1767566744000 implements MigrationInterface {
  name = 'MakeSettingsGlobal1767566744000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, delete all duplicate settings, keeping only one set of global settings
    await queryRunner.query(`
      DELETE FROM settings
      WHERE id NOT IN (
        SELECT DISTINCT ON (setting_key) id
        FROM settings
        ORDER BY setting_key, updated_at DESC
      )
    `);

    // Drop the foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "FK_e5e6bbf2d5e3c3e3d5e6bbf2d5e"`,
    );

    // Drop the unique constraint that includes user_id
    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "UQ_settings_user_id_setting_key"`,
    );

    // Drop the index on user_id and setting_key
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_settings_user_id_setting_key"`,
    );

    // Set user_id to null for all remaining settings
    await queryRunner.query(`UPDATE "settings" SET "user_id" = NULL`);

    // Drop the user_id column
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "user_id"`);

    // Add a unique constraint on setting_key only (making it global)
    await queryRunner.query(
      `ALTER TABLE "settings" ADD CONSTRAINT "UQ_settings_setting_key" UNIQUE ("setting_key")`,
    );

    // Add an index on setting_key for faster lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_settings_setting_key" ON "settings" ("setting_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint on setting_key
    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "UQ_settings_setting_key"`,
    );

    // Drop the index on setting_key
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_settings_setting_key"`);

    // Add back the user_id column
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "user_id" uuid NULL`,
    );

    // Add back the unique constraint on user_id and setting_key
    await queryRunner.query(
      `ALTER TABLE "settings" ADD CONSTRAINT "UQ_settings_user_id_setting_key" UNIQUE ("user_id", "setting_key")`,
    );

    // Add back the index on user_id and setting_key
    await queryRunner.query(
      `CREATE INDEX "IDX_settings_user_id_setting_key" ON "settings" ("user_id", "setting_key")`,
    );

    // Note: We cannot restore the foreign key constraint or restore the original per-user settings
    // This is a destructive migration in the down direction
  }
}
