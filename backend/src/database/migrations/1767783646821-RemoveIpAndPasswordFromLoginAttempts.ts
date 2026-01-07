import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIpAndPasswordFromLoginAttempts1767783646821 implements MigrationInterface {
    name = 'RemoveIpAndPasswordFromLoginAttempts1767783646821'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "login_attempts" DROP COLUMN "username"`);
        await queryRunner.query(`ALTER TABLE "login_attempts" DROP COLUMN "attempted_password"`);
        await queryRunner.query(`ALTER TABLE "login_attempts" DROP COLUMN "client_ip"`);
        await queryRunner.query(`ALTER TABLE "login_attempts" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_login_attempts_email_created" ON "login_attempts" ("email", "created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_login_attempts_email_created"`);
        await queryRunner.query(`ALTER TABLE "login_attempts" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "login_attempts" ADD "client_ip" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "login_attempts" ADD "attempted_password" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "login_attempts" ADD "username" character varying(50)`);
    }

}
