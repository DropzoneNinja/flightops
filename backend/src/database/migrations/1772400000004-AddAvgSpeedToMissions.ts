import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvgSpeedToMissions1772400000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE missions ADD COLUMN IF NOT EXISTS avg_speed float`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE missions DROP COLUMN IF EXISTS avg_speed`);
  }
}
