import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountLockingFields1767782309779 implements MigrationInterface {
    name = 'AddAccountLockingFields1767782309779'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_weather_api_logs_endpoint"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_weather_api_logs_created_at"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_locked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "failed_login_attempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_failed_login" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "locked_at" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_230b58cfa7cf810ae98491042b" ON "weather_api_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_a02381f6dea6542177b0f5c4d5" ON "weather_api_logs" ("endpoint") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a02381f6dea6542177b0f5c4d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_230b58cfa7cf810ae98491042b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locked_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_failed_login"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failed_login_attempts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_locked"`);
        await queryRunner.query(`CREATE INDEX "IDX_weather_api_logs_created_at" ON "weather_api_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_weather_api_logs_endpoint" ON "weather_api_logs" ("endpoint") `);
    }

}
