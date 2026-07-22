import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissionIdToLogbookEntries1773700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "logbook_entries" ADD COLUMN "mission_id" uuid REFERENCES "missions"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_logbook_mission_id" ON "logbook_entries" ("mission_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_logbook_mission_id"`);
    await queryRunner.query(`ALTER TABLE "logbook_entries" DROP COLUMN "mission_id"`);
  }
}
