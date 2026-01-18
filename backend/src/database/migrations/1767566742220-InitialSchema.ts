import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1767566742220 implements MigrationInterface {
    name = 'InitialSchema1767566742220'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "setting_key" character varying(100) NOT NULL, "setting_value" text NOT NULL, "setting_type" character varying(50) NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_af7c903013fbc1f0786f854e91e" UNIQUE ("user_id", "setting_key"), CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af7c903013fbc1f0786f854e91" ON "settings" ("user_id", "setting_key") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "flight_sites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "takeoff_lat" numeric(10,8) NOT NULL, "takeoff_lon" numeric(11,8) NOT NULL, "parking_lat" numeric(10,8) NOT NULL, "parking_lon" numeric(11,8) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7167de71186c82e2364fe84ba5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_62b93a1118ba8c1c6cb883157e" ON "flight_sites" ("takeoff_lat", "takeoff_lon") `);
        await queryRunner.query(`CREATE INDEX "IDX_14fac9df5fbf35d2499d85bf36" ON "flight_sites" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "weather_forecasts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "site_id" uuid NOT NULL, "forecast_date" date NOT NULL, "sunrise" TIME NOT NULL, "sunset" TIME NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bf7f920fbb8dcceaef223da7c06" UNIQUE ("site_id", "forecast_date"), CONSTRAINT "PK_2f9d659cba03be87435e9c6b251" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf7f920fbb8dcceaef223da7c0" ON "weather_forecasts" ("site_id", "forecast_date") `);
        await queryRunner.query(`CREATE TABLE "weather_hourly" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "forecast_id" uuid NOT NULL, "timestamp" TIMESTAMP NOT NULL, "temperature" numeric(5,2) NOT NULL, "wind_speed" numeric(5,2) NOT NULL, "wind_direction" numeric(5,2) NOT NULL, "gust_speed" numeric(5,2) NOT NULL, "gust_spread" numeric(5,2) NOT NULL, "rain" numeric(5,2) NOT NULL DEFAULT '0', "wind_score" integer NOT NULL, "gust_score" integer NOT NULL, "gust_spread_score" integer NOT NULL, "rain_score" integer NOT NULL, "overall_score" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fcc1519cd229839013dc358d49a" UNIQUE ("forecast_id", "timestamp"), CONSTRAINT "PK_97f237384d1f399375909a9db8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fcc1519cd229839013dc358d49" ON "weather_hourly" ("forecast_id", "timestamp") `);
        await queryRunner.query(`ALTER TABLE "settings" ADD CONSTRAINT "FK_a2883eaa72b3b2e8c98e7446098" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD CONSTRAINT "FK_14fac9df5fbf35d2499d85bf367" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "weather_forecasts" ADD CONSTRAINT "FK_4254d16a2dc4a00e694b316d592" FOREIGN KEY ("site_id") REFERENCES "flight_sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "weather_hourly" ADD CONSTRAINT "FK_c80e5e6783765f55569b16abb11" FOREIGN KEY ("forecast_id") REFERENCES "weather_forecasts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weather_hourly" DROP CONSTRAINT "FK_c80e5e6783765f55569b16abb11"`);
        await queryRunner.query(`ALTER TABLE "weather_forecasts" DROP CONSTRAINT "FK_4254d16a2dc4a00e694b316d592"`);
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP CONSTRAINT "FK_14fac9df5fbf35d2499d85bf367"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP CONSTRAINT "FK_a2883eaa72b3b2e8c98e7446098"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcc1519cd229839013dc358d49"`);
        await queryRunner.query(`DROP TABLE "weather_hourly"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf7f920fbb8dcceaef223da7c0"`);
        await queryRunner.query(`DROP TABLE "weather_forecasts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_14fac9df5fbf35d2499d85bf36"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62b93a1118ba8c1c6cb883157e"`);
        await queryRunner.query(`DROP TABLE "flight_sites"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af7c903013fbc1f0786f854e91"`);
        await queryRunner.query(`DROP TABLE "settings"`);
    }

}
