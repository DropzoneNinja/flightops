import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTemperatureAndPrecipitationToMultiHeight1767770050010 implements MigrationInterface {
    name = 'AddTemperatureAndPrecipitationToMultiHeight1767770050010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns to weather_multi_height table
        await queryRunner.query(`
            ALTER TABLE "weather_multi_height"
            ADD COLUMN "temperature_2m" numeric(5,2),
            ADD COLUMN "temperature_80m" numeric(5,2),
            ADD COLUMN "temperature_120m" numeric(5,2),
            ADD COLUMN "precipitation" numeric(5,2),
            ADD COLUMN "wind_gusts_10m" numeric(5,2)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns in reverse
        await queryRunner.query(`
            ALTER TABLE "weather_multi_height"
            DROP COLUMN "wind_gusts_10m",
            DROP COLUMN "precipitation",
            DROP COLUMN "temperature_120m",
            DROP COLUMN "temperature_80m",
            DROP COLUMN "temperature_2m"
        `);
    }

}
