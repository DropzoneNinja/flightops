import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStorageUsedToUsers1772169362300 implements MigrationInterface {
    name = 'AddStorageUsedToUsers1772169362300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "storage_used" bigint NOT NULL DEFAULT 0`);
        // Backfill storage_used from existing media records
        await queryRunner.query(`
            UPDATE "users" SET "storage_used" = (
                SELECT COALESCE(SUM("file_size"), 0) FROM "media"
                WHERE "media"."uploaded_by" = "users"."username"
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "storage_used"`);
    }
}
