import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissionIdToMedia1772500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "mission_id" uuid REFERENCES "missions"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_media_mission_id" ON "media" ("mission_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_media_mission_id"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mission_id"`);
  }
}
