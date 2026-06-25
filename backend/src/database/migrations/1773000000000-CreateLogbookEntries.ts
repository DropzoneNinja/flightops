import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateLogbookEntries1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "logbook_source_enum" AS ENUM('flightnow', 'manual', 'web');
    `);

    await queryRunner.createTable(
      new Table({
        name: 'logbook_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          // Identity & ownership
          { name: 'pilot_id', type: 'uuid', isNullable: false },
          { name: 'client_id', type: 'uuid', isNullable: false },
          { name: 'source', type: 'logbook_source_enum', default: "'web'", isNullable: false },
          // Linkage
          { name: 'flight_id', type: 'uuid', isNullable: true },
          { name: 'site_id', type: 'uuid', isNullable: true },
          // Flight metadata
          { name: 'flight_date', type: 'date', isNullable: false },
          { name: 'start_at', type: 'timestamptz', isNullable: true },
          { name: 'end_at', type: 'timestamptz', isNullable: true },
          { name: 'duration_seconds', type: 'int', isNullable: true },
          { name: 'distance_m', type: 'float', isNullable: true },
          { name: 'avg_speed_mps', type: 'float', isNullable: true },
          { name: 'max_speed_mps', type: 'float', isNullable: true },
          { name: 'max_altitude_m', type: 'float', isNullable: true },
          { name: 'avg_altitude_m', type: 'float', isNullable: true },
          { name: 'max_climb_mps', type: 'float', isNullable: true },
          { name: 'max_sink_mps', type: 'float', isNullable: true },
          { name: 'takeoff_lat', type: 'decimal', precision: 10, scale: 7, isNullable: true },
          { name: 'takeoff_lon', type: 'decimal', precision: 10, scale: 7, isNullable: true },
          { name: 'landing_lat', type: 'decimal', precision: 10, scale: 7, isNullable: true },
          { name: 'landing_lon', type: 'decimal', precision: 10, scale: 7, isNullable: true },
          { name: 'launch_site_name', type: 'text', isNullable: true },
          { name: 'landing_site_name', type: 'text', isNullable: true },
          { name: 'title', type: 'text', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          // Equipment / fuel
          { name: 'wing', type: 'text', isNullable: true },
          { name: 'engine', type: 'text', isNullable: true },
          { name: 'paramotor', type: 'text', isNullable: true },
          { name: 'equipment_refs_json', type: 'jsonb', isNullable: true },
          { name: 'fuel_start_litres', type: 'float', isNullable: true },
          { name: 'fuel_used_litres', type: 'float', isNullable: true },
          { name: 'battery_start_percent', type: 'float', isNullable: true },
          { name: 'battery_used_percent', type: 'float', isNullable: true },
          // Categorization
          { name: 'category', type: 'text', isNullable: true },
          { name: 'flight_purpose', type: 'text', isNullable: true },
          { name: 'route_name', type: 'text', isNullable: true },
          { name: 'rating', type: 'smallint', isNullable: true },
          // Weather snapshot (server-authoritative)
          { name: 'weather_snapshot', type: 'jsonb', isNullable: true },
          { name: 'weather_captured_at', type: 'timestamptz', isNullable: true },
          { name: 'weather_source', type: 'text', isNullable: true },
          // Sync / lifecycle
          { name: 'revision', type: 'int', default: 1, isNullable: false },
          { name: 'client_updated_at', type: 'timestamptz', isNullable: true },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
          { name: 'synced_at', type: 'timestamptz', isNullable: true },
          { name: 'created_by_user_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // Indexes
    await queryRunner.createIndex('logbook_entries', new TableIndex({ name: 'IDX_LOGBOOK_PILOT_ID', columnNames: ['pilot_id'] }));
    await queryRunner.createIndex('logbook_entries', new TableIndex({ name: 'IDX_LOGBOOK_PILOT_DATE', columnNames: ['pilot_id', 'flight_date'] }));
    await queryRunner.createIndex('logbook_entries', new TableIndex({ name: 'IDX_LOGBOOK_PILOT_UPDATED', columnNames: ['pilot_id', 'updated_at'] }));
    await queryRunner.createIndex('logbook_entries', new TableIndex({ name: 'IDX_LOGBOOK_FLIGHT_ID', columnNames: ['flight_id'] }));
    await queryRunner.createIndex('logbook_entries', new TableIndex({ name: 'IDX_LOGBOOK_DELETED_AT', columnNames: ['deleted_at'] }));

    // Unique dedup key
    await queryRunner.createIndex(
      'logbook_entries',
      new TableIndex({ name: 'UQ_LOGBOOK_PILOT_CLIENT', columnNames: ['pilot_id', 'client_id'], isUnique: true }),
    );

    // Foreign keys
    await queryRunner.createForeignKey('logbook_entries', new TableForeignKey({
      name: 'FK_LOGBOOK_PILOT_ID',
      columnNames: ['pilot_id'],
      referencedTableName: 'pilots',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));
    await queryRunner.createForeignKey('logbook_entries', new TableForeignKey({
      name: 'FK_LOGBOOK_FLIGHT_ID',
      columnNames: ['flight_id'],
      referencedTableName: 'flights',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    }));
    await queryRunner.createForeignKey('logbook_entries', new TableForeignKey({
      name: 'FK_LOGBOOK_SITE_ID',
      columnNames: ['site_id'],
      referencedTableName: 'flight_sites',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    }));
    await queryRunner.createForeignKey('logbook_entries', new TableForeignKey({
      name: 'FK_LOGBOOK_CREATED_BY',
      columnNames: ['created_by_user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    }));

    // Enforce one-pilot-per-user (partial unique on pilots.user_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_PILOTS_USER_ID"
      ON "pilots" ("user_id")
      WHERE "user_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_PILOTS_USER_ID";`);
    await queryRunner.dropForeignKey('logbook_entries', 'FK_LOGBOOK_CREATED_BY');
    await queryRunner.dropForeignKey('logbook_entries', 'FK_LOGBOOK_SITE_ID');
    await queryRunner.dropForeignKey('logbook_entries', 'FK_LOGBOOK_FLIGHT_ID');
    await queryRunner.dropForeignKey('logbook_entries', 'FK_LOGBOOK_PILOT_ID');
    await queryRunner.dropIndex('logbook_entries', 'UQ_LOGBOOK_PILOT_CLIENT');
    await queryRunner.dropIndex('logbook_entries', 'IDX_LOGBOOK_DELETED_AT');
    await queryRunner.dropIndex('logbook_entries', 'IDX_LOGBOOK_FLIGHT_ID');
    await queryRunner.dropIndex('logbook_entries', 'IDX_LOGBOOK_PILOT_UPDATED');
    await queryRunner.dropIndex('logbook_entries', 'IDX_LOGBOOK_PILOT_DATE');
    await queryRunner.dropIndex('logbook_entries', 'IDX_LOGBOOK_PILOT_ID');
    await queryRunner.dropTable('logbook_entries');
    await queryRunner.query(`DROP TYPE "logbook_source_enum";`);
  }
}
