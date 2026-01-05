import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsAdminToUser1767580254293 implements MigrationInterface {
    name = 'AddIsAdminToUser1767580254293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "is_admin" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_admin"`);
    }

}
