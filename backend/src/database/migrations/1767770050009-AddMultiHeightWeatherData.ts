import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMultiHeightWeatherData1767770050009 implements MigrationInterface {
    name = 'AddMultiHeightWeatherData1767770050009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_users_username"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pre_authorized_emails_email"`);
        await queryRunner.query(`CREATE TABLE "weather_multi_height" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "forecast_id" uuid NOT NULL, "timestamp" TIMESTAMP NOT NULL, "wind_speed_10m" numeric(5,2) NOT NULL, "wind_direction_10m" numeric(5,2) NOT NULL, "wind_speed_80m" numeric(5,2) NOT NULL, "wind_direction_80m" numeric(5,2) NOT NULL, "wind_speed_120m" numeric(5,2) NOT NULL, "wind_direction_120m" numeric(5,2) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97439df4a873028d2b286a7e96f" UNIQUE ("forecast_id", "timestamp"), CONSTRAINT "PK_c76c76829fa1371b23de8c94642" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97439df4a873028d2b286a7e96" ON "weather_multi_height" ("forecast_id", "timestamp") `);
        await queryRunner.query(`ALTER TABLE "weather_hourly" ALTER COLUMN "wind_direction" DROP DEFAULT`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3cab18ba9a825d0d09b896fad7" ON "pre_authorized_emails" ("email") `);
        await queryRunner.query(`ALTER TABLE "weather_multi_height" ADD CONSTRAINT "FK_cd238ed424deb1e4e9d6f55637f" FOREIGN KEY ("forecast_id") REFERENCES "weather_forecasts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weather_multi_height" DROP CONSTRAINT "FK_cd238ed424deb1e4e9d6f55637f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3cab18ba9a825d0d09b896fad7"`);
        await queryRunner.query(`ALTER TABLE "weather_hourly" ALTER COLUMN "wind_direction" SET DEFAULT '0'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97439df4a873028d2b286a7e96"`);
        await queryRunner.query(`DROP TABLE "weather_multi_height"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_pre_authorized_emails_email" ON "pre_authorized_emails" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username") WHERE (username IS NOT NULL)`);
    }

}
