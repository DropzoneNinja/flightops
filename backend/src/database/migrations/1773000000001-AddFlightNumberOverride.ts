import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlightNumberOverride1773000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "logbook_entries"
      ADD COLUMN IF NOT EXISTS "flight_number_override" integer NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "logbook_entries"
      DROP COLUMN IF EXISTS "flight_number_override";
    `);
  }
}
