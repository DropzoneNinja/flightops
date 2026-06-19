import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkUsersToPilots1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Link existing unowned pilots to users by matching slug to username-derived slug.
    await queryRunner.query(`
      UPDATE pilots p
      SET user_id = u.id
      FROM users u
      WHERE p.user_id IS NULL
        AND u.username IS NOT NULL
        AND p.slug = lower(
          regexp_replace(
            regexp_replace(trim(u.username), '[^a-z0-9]+', '-', 'gi'),
            '^-|-$', '', 'g'
          )
        )
    `);

    // Step 2: Create new pilot records for users who still have no linked pilot.
    await queryRunner.query(`
      INSERT INTO pilots (id, display_name, slug, user_id, created_at, updated_at)
      SELECT
        uuid_generate_v4(),
        u.username,
        lower(
          regexp_replace(
            regexp_replace(trim(u.username), '[^a-z0-9]+', '-', 'gi'),
            '^-|-$', '', 'g'
          )
        ),
        u.id,
        now(),
        now()
      FROM users u
      WHERE u.username IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM pilots p WHERE p.user_id = u.id
        )
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Unlink pilots from users where the pilot display_name matches the user's username.
    await queryRunner.query(`
      UPDATE pilots p
      SET user_id = NULL
      FROM users u
      WHERE p.user_id = u.id
        AND p.display_name = u.username
    `);
  }
}
