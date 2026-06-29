import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogbookEquipmentRefs1773200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "logbook_entries"
        ADD COLUMN "wing_id" uuid REFERENCES "equipment_wings"("id") ON DELETE SET NULL,
        ADD COLUMN "paramotor_id" uuid REFERENCES "equipment_paramotors"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_logbook_wing_id" ON "logbook_entries" ("wing_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_logbook_paramotor_id" ON "logbook_entries" ("paramotor_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_logbook_paramotor_id"`);
    await queryRunner.query(`DROP INDEX "IDX_logbook_wing_id"`);
    await queryRunner.query(`ALTER TABLE "logbook_entries" DROP COLUMN "paramotor_id"`);
    await queryRunner.query(`ALTER TABLE "logbook_entries" DROP COLUMN "wing_id"`);
  }
}
