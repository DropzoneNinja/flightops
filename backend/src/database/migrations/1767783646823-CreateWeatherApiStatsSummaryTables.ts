import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWeatherApiStatsSummaryTables1767783646823 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create weather_api_stats_daily table
    await queryRunner.query(`
      CREATE TABLE "weather_api_stats_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" DATE NOT NULL,
        "total_calls" INTEGER NOT NULL DEFAULT 0,
        "is_max" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weather_api_stats_daily" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weather_api_stats_daily_date" ON "weather_api_stats_daily" ("date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_weather_api_stats_daily_is_max" ON "weather_api_stats_daily" ("is_max") WHERE "is_max" = true
    `);

    // 2. Create weather_api_stats_hourly table
    await queryRunner.query(`
      CREATE TABLE "weather_api_stats_hourly" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hour_timestamp" TIMESTAMP NOT NULL,
        "total_calls" INTEGER NOT NULL DEFAULT 0,
        "is_max" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weather_api_stats_hourly" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weather_api_stats_hourly_hour_timestamp" ON "weather_api_stats_hourly" ("hour_timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_weather_api_stats_hourly_is_max" ON "weather_api_stats_hourly" ("is_max") WHERE "is_max" = true
    `);

    // 3. Create weather_api_stats_endpoints table
    await queryRunner.query(`
      CREATE TABLE "weather_api_stats_endpoints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "endpoint" VARCHAR(255) NOT NULL,
        "total_calls" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weather_api_stats_endpoints" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_weather_api_stats_endpoints_endpoint" ON "weather_api_stats_endpoints" ("endpoint")
    `);

    // 4. Populate daily stats from existing weather_api_logs (if table exists)
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'weather_api_logs'
      )
    `);

    if (tableExists[0].exists) {
      // Populate daily stats
      await queryRunner.query(`
        INSERT INTO "weather_api_stats_daily" ("date", "total_calls", "is_max", "updated_at")
        SELECT
          DATE(created_at) as date,
          COUNT(*)::INTEGER as total_calls,
          false as is_max,
          MAX(created_at) as updated_at
        FROM "weather_api_logs"
        GROUP BY DATE(created_at)
      `);

      // Mark the day with max calls
      await queryRunner.query(`
        UPDATE "weather_api_stats_daily"
        SET "is_max" = true
        WHERE "total_calls" = (
          SELECT MAX("total_calls") FROM "weather_api_stats_daily"
        )
        AND "id" = (
          SELECT "id" FROM "weather_api_stats_daily"
          WHERE "total_calls" = (SELECT MAX("total_calls") FROM "weather_api_stats_daily")
          ORDER BY "date" ASC
          LIMIT 1
        )
      `);

      // Populate hourly stats
      await queryRunner.query(`
        INSERT INTO "weather_api_stats_hourly" ("hour_timestamp", "total_calls", "is_max", "updated_at")
        SELECT
          DATE_TRUNC('hour', created_at) as hour_timestamp,
          COUNT(*)::INTEGER as total_calls,
          false as is_max,
          MAX(created_at) as updated_at
        FROM "weather_api_logs"
        GROUP BY DATE_TRUNC('hour', created_at)
      `);

      // Mark the hour with max calls
      await queryRunner.query(`
        UPDATE "weather_api_stats_hourly"
        SET "is_max" = true
        WHERE "total_calls" = (
          SELECT MAX("total_calls") FROM "weather_api_stats_hourly"
        )
        AND "id" = (
          SELECT "id" FROM "weather_api_stats_hourly"
          WHERE "total_calls" = (SELECT MAX("total_calls") FROM "weather_api_stats_hourly")
          ORDER BY "hour_timestamp" ASC
          LIMIT 1
        )
      `);

      // Populate endpoint stats
      await queryRunner.query(`
        INSERT INTO "weather_api_stats_endpoints" ("endpoint", "total_calls", "updated_at")
        SELECT
          endpoint,
          COUNT(*)::INTEGER as total_calls,
          MAX(created_at) as updated_at
        FROM "weather_api_logs"
        GROUP BY endpoint
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and tables in reverse order
    await queryRunner.query(`DROP INDEX "IDX_weather_api_stats_endpoints_endpoint"`);
    await queryRunner.query(`DROP TABLE "weather_api_stats_endpoints"`);

    await queryRunner.query(`DROP INDEX "IDX_weather_api_stats_hourly_is_max"`);
    await queryRunner.query(`DROP INDEX "IDX_weather_api_stats_hourly_hour_timestamp"`);
    await queryRunner.query(`DROP TABLE "weather_api_stats_hourly"`);

    await queryRunner.query(`DROP INDEX "IDX_weather_api_stats_daily_is_max"`);
    await queryRunner.query(`DROP INDEX "IDX_weather_api_stats_daily_date"`);
    await queryRunner.query(`DROP TABLE "weather_api_stats_daily"`);
  }
}
