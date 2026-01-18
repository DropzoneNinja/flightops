import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUuidExtension1767566742000 implements MigrationInterface {
  name = 'EnableUuidExtension1767566742000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension for PostgreSQL
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop UUID extension (careful - this will break tables using UUIDs)
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
