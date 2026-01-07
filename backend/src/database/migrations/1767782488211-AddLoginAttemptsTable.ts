import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoginAttemptsTable1767782488211 implements MigrationInterface {
    name = 'AddLoginAttemptsTable1767782488211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "login_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255), "username" character varying(50), "attempted_password" character varying(255) NOT NULL, "client_ip" character varying(255) NOT NULL, "success" boolean NOT NULL DEFAULT false, "failure_reason" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_070e613c8f768b1a70742705c5b" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "login_attempts"`);
    }

}
