import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApkReleaseTables1773800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "apk_releases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version_label" text NOT NULL,
        "release_notes" text,
        "original_filename" text NOT NULL,
        "file_path" text NOT NULL,
        "file_size" bigint NOT NULL,
        "uploaded_by" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_apk_releases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "apk_access" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "granted_by_user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_apk_access" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_apk_access_user" UNIQUE ("user_id"),
        CONSTRAINT "FK_apk_access_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_apk_access_granted_by" FOREIGN KEY ("granted_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "apk_access"`);
    await queryRunner.query(`DROP TABLE "apk_releases"`);
  }
}
