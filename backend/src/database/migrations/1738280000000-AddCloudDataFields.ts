import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCloudDataFields1738280000000 implements MigrationInterface {
    name = 'AddCloudDataFields1738280000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add cloud data columns to weather_hourly table
        await queryRunner.query(`
            ALTER TABLE "weather_hourly"
            ADD COLUMN IF NOT EXISTS "cloud_cover" numeric(5,2),
            ADD COLUMN IF NOT EXISTS "cloud_base" numeric(6,2),
            ADD COLUMN IF NOT EXISTS "cloud_score" integer DEFAULT 100
        `);

        // Add cloud data columns to weather_multi_height table
        await queryRunner.query(`
            ALTER TABLE "weather_multi_height"
            ADD COLUMN IF NOT EXISTS "cloud_cover" numeric(5,2),
            ADD COLUMN IF NOT EXISTS "cloud_base" numeric(6,2)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns from weather_hourly
        await queryRunner.query(`
            ALTER TABLE "weather_hourly"
            DROP COLUMN "cloud_score",
            DROP COLUMN "cloud_base",
            DROP COLUMN "cloud_cover"
        `);

        // Remove columns from weather_multi_height
        await queryRunner.query(`
            ALTER TABLE "weather_multi_height"
            DROP COLUMN "cloud_base",
            DROP COLUMN "cloud_cover"
        `);
    }

}
