import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Raises the OpenSky airspace query radius from 5 km to 10 km (20 km
 * diameter). Only rows still holding the old default are touched, so an
 * admin-customized radius is preserved.
 */
export class IncreaseOpenSkyRadiusDefault1773500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "settings" SET "setting_value" = '10' WHERE "setting_key" = 'opensky.airspace_radius_km' AND "setting_value" = '5'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "settings" SET "setting_value" = '5' WHERE "setting_key" = 'opensky.airspace_radius_km' AND "setting_value" = '10'`,
    );
  }
}
