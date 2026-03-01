import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserViewCounters1772200000000 implements MigrationInterface {
    name = 'AddUserViewCounters1772200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "images_viewed_count" bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD "videos_viewed_count" bigint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "videos_viewed_count"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "images_viewed_count"`);
    }
}
