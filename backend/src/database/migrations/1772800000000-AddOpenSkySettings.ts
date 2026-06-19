import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpenSkySettings1772800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO settings (setting_key, setting_value, setting_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key) DO NOTHING`,
      ['opensky.airspace_radius_km', '5', 'number'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM settings WHERE setting_key = $1`,
      ['opensky.airspace_radius_km'],
    );
  }
}
