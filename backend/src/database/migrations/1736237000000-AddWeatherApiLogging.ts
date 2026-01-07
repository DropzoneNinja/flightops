import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWeatherApiLogging1736237000000 implements MigrationInterface {
    name = 'AddWeatherApiLogging1736237000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "weather_api_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "endpoint" character varying(255) NOT NULL,
                "user_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_weather_api_logs" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_weather_api_logs_endpoint" ON "weather_api_logs" ("endpoint")`);
        await queryRunner.query(`CREATE INDEX "IDX_weather_api_logs_created_at" ON "weather_api_logs" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_weather_api_logs_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_weather_api_logs_endpoint"`);
        await queryRunner.query(`DROP TABLE "weather_api_logs"`);
    }
}
