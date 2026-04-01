import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGaggleFieldsToFlights1772300000005 implements MigrationInterface {
  name = 'AddGaggleFieldsToFlights1772300000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_distance_m" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_max_speed_mps" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_duration_seconds" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_avg_speed_mps" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_max_altitude_m" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_max_climb_mps" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_max_g_force" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_max_sink_mps" float`);
    await queryRunner.query(`ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "gaggle_fuel_consumed" float`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_fuel_consumed"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_max_sink_mps"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_max_g_force"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_max_climb_mps"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_max_altitude_m"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_avg_speed_mps"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_duration_seconds"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_max_speed_mps"`);
    await queryRunner.query(`ALTER TABLE "flights" DROP COLUMN IF EXISTS "gaggle_distance_m"`);
  }
}
