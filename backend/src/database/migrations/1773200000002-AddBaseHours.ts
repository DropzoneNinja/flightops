import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBaseHours1773200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment_engines"
        ADD COLUMN "base_hours" float NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_wings"
        ADD COLUMN "base_hours" float NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_paramotors"
        ADD COLUMN "base_hours" float NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "equipment_engines" DROP COLUMN "base_hours"`);
    await queryRunner.query(`ALTER TABLE "equipment_wings" DROP COLUMN "base_hours"`);
    await queryRunner.query(`ALTER TABLE "equipment_paramotors" DROP COLUMN "base_hours"`);
  }
}
