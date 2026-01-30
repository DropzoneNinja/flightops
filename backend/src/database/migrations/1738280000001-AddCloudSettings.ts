import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCloudSettings1738280000001 implements MigrationInterface {
  name = 'AddCloudSettings1738280000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cloud threshold settings
    const cloudSettings = [
      {
        key: 'thresholds.cloud.base_min_safe',
        value: '1000',
        type: 'number',
      },
      {
        key: 'thresholds.cloud.cover_max_safe',
        value: '80',
        type: 'number',
      },
    ];

    // Insert cloud settings only if they don't exist
    for (const setting of cloudSettings) {
      await queryRunner.query(
        `
        INSERT INTO settings (setting_key, setting_value, setting_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO NOTHING
      `,
        [setting.key, setting.value, setting.type],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete cloud settings
    const settingKeys = [
      'thresholds.cloud.base_min_safe',
      'thresholds.cloud.cover_max_safe',
    ];

    await queryRunner.query(
      `DELETE FROM settings WHERE setting_key = ANY($1)`,
      [settingKeys],
    );
  }
}
