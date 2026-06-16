import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPositionToPilots1772600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pilots"
        ADD COLUMN "lat" numeric(10,7),
        ADD COLUMN "lon" numeric(10,7),
        ADD COLUMN "flight_state" varchar(10),
        ADD COLUMN "position_updated_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pilots"
        DROP COLUMN "lat",
        DROP COLUMN "lon",
        DROP COLUMN "flight_state",
        DROP COLUMN "position_updated_at"
    `);
  }
}
