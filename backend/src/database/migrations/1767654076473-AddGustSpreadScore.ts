import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGustSpreadScore1767654076473 implements MigrationInterface {
    name = 'AddGustSpreadScore1767654076473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weather_hourly" ALTER COLUMN "gust_spread_score" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weather_hourly" ALTER COLUMN "gust_spread_score" SET DEFAULT '0'`);
    }

}
