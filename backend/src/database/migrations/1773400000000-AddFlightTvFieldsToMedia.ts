import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlightTvFieldsToMedia1773400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media"
        ADD COLUMN "title" text,
        ADD COLUMN "description" text,
        ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "aircraft" text,
        ADD COLUMN "wing" text,
        ADD COLUMN "engine" text,
        ADD COLUMN "favorite" boolean NOT NULL DEFAULT false,
        ADD COLUMN "rating" smallint,
        ADD COLUMN "duration_seconds" real,
        ADD COLUMN "image_width" integer,
        ADD COLUMN "image_height" integer,
        ADD COLUMN "video_width" integer,
        ADD COLUMN "video_height" integer,
        ADD COLUMN "flight_id" uuid REFERENCES "flights"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "CHK_media_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5))
    `);
    await queryRunner.query(`CREATE INDEX "IDX_media_flight_id" ON "media" ("flight_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_media_favorite" ON "media" ("favorite")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_media_favorite"`);
    await queryRunner.query(`DROP INDEX "IDX_media_flight_id"`);
    await queryRunner.query(`
      ALTER TABLE "media"
        DROP CONSTRAINT "CHK_media_rating_range",
        DROP COLUMN "flight_id",
        DROP COLUMN "video_height",
        DROP COLUMN "video_width",
        DROP COLUMN "image_height",
        DROP COLUMN "image_width",
        DROP COLUMN "duration_seconds",
        DROP COLUMN "rating",
        DROP COLUMN "favorite",
        DROP COLUMN "engine",
        DROP COLUMN "wing",
        DROP COLUMN "aircraft",
        DROP COLUMN "tags",
        DROP COLUMN "description",
        DROP COLUMN "title"
    `);
  }
}
