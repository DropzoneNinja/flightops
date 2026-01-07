import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreAuthorizedEmails1767748576416 implements MigrationInterface {
    name = 'AddPreAuthorizedEmails1767748576416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "pre_authorized_emails" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(255) NOT NULL,
                "notes" text,
                "added_by_user_id" uuid,
                "used" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_pre_authorized_emails_email" UNIQUE ("email"),
                CONSTRAINT "PK_pre_authorized_emails" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_pre_authorized_emails_email"
            ON "pre_authorized_emails" ("email")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_pre_authorized_emails_email"`);
        await queryRunner.query(`DROP TABLE "pre_authorized_emails"`);
    }

}
