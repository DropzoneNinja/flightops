import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaCounters1767783646824 implements MigrationInterface {
    name = 'AddMediaCounters1767783646824'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media" ADD "view_count" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "media" ADD "download_count" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "download_count"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "view_count"`);
    }

}
