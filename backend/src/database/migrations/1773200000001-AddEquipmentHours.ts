import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEquipmentHours1773200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment_engines"
        ADD COLUMN "total_hours" float NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_wings"
        ADD COLUMN "total_hours" float NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_paramotors"
        ADD COLUMN "total_hours" float NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "equipment_engines" DROP COLUMN "total_hours"`);
    await queryRunner.query(`ALTER TABLE "equipment_wings" DROP COLUMN "total_hours"`);
    await queryRunner.query(`ALTER TABLE "equipment_paramotors" DROP COLUMN "total_hours"`);
  }
}
