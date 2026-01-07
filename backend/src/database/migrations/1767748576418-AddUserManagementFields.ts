import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserManagementFields1767748576418 implements MigrationInterface {
    name = 'AddUserManagementFields1767748576418'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "last_login" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "needs_password_reset" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "needs_password_reset"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login"`);
    }

}
