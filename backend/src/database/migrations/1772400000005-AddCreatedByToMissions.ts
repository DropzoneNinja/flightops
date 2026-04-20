import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedByToMissions1772400000005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS created_by UUID NULL`);
    await queryRunner.query(`
      ALTER TABLE missions
        ADD CONSTRAINT fk_missions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE missions DROP CONSTRAINT IF EXISTS fk_missions_created_by`);
    await queryRunner.query(`ALTER TABLE missions DROP COLUMN IF EXISTS created_by`);
  }
}
