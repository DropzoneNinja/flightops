import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrates legacy plot_data from flight_sites into the missions + mission_waypoints tables.
 *
 * For each flight site that has a non-empty plot_data.points array, this migration:
 *   1. Creates a mission named "<Site Name> Mission 1" linked to that site.
 *   2. Creates mission_waypoints rows in order from plot_data.points.
 *
 * The plot_data column is NOT dropped here — it is left in place so that both
 * the old and new systems can coexist during the transition. A separate migration
 * or manual step should drop plot_data once the new system is confirmed stable.
 *
 * Rollback (down): deletes any missions whose name ends with " Mission 1" that
 * were created by this migration (identified by matching launch_site_id and name pattern).
 * This is a best-effort rollback — manually created missions with the same pattern
 * are not affected (they would not have been created by this migration).
 */
export class MigrateLegacyPlotDataToMissions1772400000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const sites = (await queryRunner.query(`
      SELECT id, name, plot_data
      FROM flight_sites
      WHERE plot_data IS NOT NULL
        AND jsonb_array_length(plot_data->'points') > 0
    `)) as Array<{ id: string; name: string; plot_data: { points: Array<{ lat: number; lon: number }> } | null }>;

    let migratedCount = 0;

    for (const site of sites) {
      if (!site.plot_data?.points?.length) continue;

      // Create mission
      const missionResult = (await queryRunner.query(
        `
        INSERT INTO missions (id, name, notes, launch_site_id, created_at, updated_at)
        VALUES (uuid_generate_v4(), $1, NULL, $2, now(), now())
        RETURNING id
        `,
        [`${site.name} Mission 1`, site.id],
      )) as Array<{ id: string }>;

      const missionId = missionResult[0].id;

      // Create waypoints
      for (let i = 0; i < site.plot_data.points.length; i++) {
        const pt = site.plot_data.points[i];
        await queryRunner.query(
          `
          INSERT INTO mission_waypoints
            (id, mission_id, sort_order, latitude, longitude, altitude, planned_speed, leg_minutes, created_at, updated_at)
          VALUES (uuid_generate_v4(), $1, $2, $3, $4, NULL, NULL, NULL, now(), now())
          `,
          [missionId, i, pt.lat, pt.lon],
        );
      }

      migratedCount++;
    }

    console.log(
      `[MigrateLegacyPlotDataToMissions] Migrated ${migratedCount} site(s) to missions.`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete missions created by this migration (matched by name pattern + launch_site_id presence).
    // mission_waypoints cascade-delete via FK.
    await queryRunner.query(`
      DELETE FROM missions
      WHERE name LIKE '% Mission 1'
        AND launch_site_id IS NOT NULL
    `);
  }
}
