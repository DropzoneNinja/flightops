import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMergeFlagsToLogbookEntries1773900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "logbook_entries" ADD COLUMN "merge_flagged_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "logbook_entries" ADD COLUMN "merge_flagged_reason" TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "logbook_entries" DROP COLUMN "merge_flagged_reason"`);
    await queryRunner.query(`ALTER TABLE "logbook_entries" DROP COLUMN "merge_flagged_at"`);
  }
}
