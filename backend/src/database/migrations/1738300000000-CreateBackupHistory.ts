import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBackupHistory1738300000000 implements MigrationInterface {
    name = 'CreateBackupHistory1738300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "backup_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "filename" character varying(255) NOT NULL, "status" character varying(20) NOT NULL, "type" character varying(20) NOT NULL, "error_message" text, "file_size_bytes" bigint, "duration_ms" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_backup_history_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_backup_history_created_at" ON "backup_history" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_backup_history_created_at"`);
        await queryRunner.query(`DROP TABLE "backup_history"`);
    }

}
