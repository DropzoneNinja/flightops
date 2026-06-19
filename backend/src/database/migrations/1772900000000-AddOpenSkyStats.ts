import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpenSkyStats1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE opensky_api_stats_daily (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        date            DATE NOT NULL UNIQUE,
        total_calls     INTEGER NOT NULL DEFAULT 0,
        rejected_calls  INTEGER NOT NULL DEFAULT 0,
        is_max          BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_opensky_stats_daily_date   ON opensky_api_stats_daily (date);
      CREATE INDEX idx_opensky_stats_daily_is_max ON opensky_api_stats_daily (is_max) WHERE is_max = true;
    `);

    await queryRunner.query(`
      CREATE TABLE opensky_api_stats_hourly (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        hour_timestamp  TIMESTAMP NOT NULL UNIQUE,
        total_calls     INTEGER NOT NULL DEFAULT 0,
        rejected_calls  INTEGER NOT NULL DEFAULT 0,
        is_max          BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_opensky_stats_hourly_ts     ON opensky_api_stats_hourly (hour_timestamp);
      CREATE INDEX idx_opensky_stats_hourly_is_max ON opensky_api_stats_hourly (is_max) WHERE is_max = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS opensky_api_stats_hourly`);
    await queryRunner.query(`DROP TABLE IF EXISTS opensky_api_stats_daily`);
  }
}
