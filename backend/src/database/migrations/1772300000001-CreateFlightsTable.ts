import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateFlightsTable1772300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "flight_parse_status_enum" AS ENUM('uploaded', 'parsing', 'analyzed', 'failed');
    `);
    await queryRunner.query(`
      CREATE TYPE "flight_analysis_status_enum" AS ENUM('pending', 'running', 'complete', 'failed');
    `);

    await queryRunner.createTable(
      new Table({
        name: 'flights',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'flight_date', type: 'date', isNullable: false },
          { name: 'site_id', type: 'uuid', isNullable: true },
          { name: 'pilot_id', type: 'uuid', isNullable: true },
          { name: 'title', type: 'text', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'launch_site_name', type: 'text', isNullable: true },
          { name: 'landing_site_name', type: 'text', isNullable: true },
          { name: 'glider', type: 'text', isNullable: true },
          { name: 'harness', type: 'text', isNullable: true },
          { name: 'timezone', type: 'varchar', length: '100', default: "'UTC'", isNullable: false },
          { name: 'original_filename', type: 'text', isNullable: false },
          { name: 'storage_key', type: 'text', isNullable: false },
          { name: 'file_size', type: 'bigint', isNullable: false },
          {
            name: 'parse_status',
            type: 'flight_parse_status_enum',
            default: "'uploaded'",
            isNullable: false,
          },
          {
            name: 'analysis_status',
            type: 'flight_analysis_status_enum',
            default: "'pending'",
            isNullable: false,
          },
          { name: 'analysis_version', type: 'varchar', length: '50', isNullable: true },
          { name: 'start_at', type: 'timestamp', isNullable: true },
          { name: 'end_at', type: 'timestamp', isNullable: true },
          { name: 'duration_seconds', type: 'int', isNullable: true },
          { name: 'total_distance_m', type: 'float', isNullable: true },
          { name: 'max_altitude_m', type: 'float', isNullable: true },
          { name: 'min_altitude_m', type: 'float', isNullable: true },
          { name: 'altitude_gain_m', type: 'float', isNullable: true },
          { name: 'altitude_loss_m', type: 'float', isNullable: true },
          { name: 'avg_speed_mps', type: 'float', isNullable: true },
          { name: 'max_speed_mps', type: 'float', isNullable: true },
          { name: 'max_climb_mps', type: 'float', isNullable: true },
          { name: 'max_descent_mps', type: 'float', isNullable: true },
          { name: 'trackpoint_count', type: 'int', isNullable: true },
          { name: 'segment_count', type: 'int', isNullable: true },
          { name: 'bbox_json', type: 'jsonb', isNullable: true },
          { name: 'confidence_score', type: 'float', isNullable: true },
          { name: 'summary_json', type: 'jsonb', isNullable: true },
          { name: 'trackpoints_json', type: 'jsonb', isNullable: true },
          { name: 'uploaded_by', type: 'uuid', isNullable: false },
          { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'flights',
      new TableIndex({ name: 'IDX_FLIGHTS_FLIGHT_DATE', columnNames: ['flight_date'] }),
    );
    await queryRunner.createIndex(
      'flights',
      new TableIndex({ name: 'IDX_FLIGHTS_PILOT_ID', columnNames: ['pilot_id'] }),
    );

    await queryRunner.createForeignKey(
      'flights',
      new TableForeignKey({
        name: 'FK_FLIGHTS_PILOT_ID',
        columnNames: ['pilot_id'],
        referencedTableName: 'pilots',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'flights',
      new TableForeignKey({
        name: 'FK_FLIGHTS_SITE_ID',
        columnNames: ['site_id'],
        referencedTableName: 'flight_sites',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'flights',
      new TableForeignKey({
        name: 'FK_FLIGHTS_UPLOADED_BY',
        columnNames: ['uploaded_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('flights', 'FK_FLIGHTS_UPLOADED_BY');
    await queryRunner.dropForeignKey('flights', 'FK_FLIGHTS_SITE_ID');
    await queryRunner.dropForeignKey('flights', 'FK_FLIGHTS_PILOT_ID');
    await queryRunner.dropIndex('flights', 'IDX_FLIGHTS_PILOT_ID');
    await queryRunner.dropIndex('flights', 'IDX_FLIGHTS_FLIGHT_DATE');
    await queryRunner.dropTable('flights');
    await queryRunner.query(`DROP TYPE "flight_analysis_status_enum";`);
    await queryRunner.query(`DROP TYPE "flight_parse_status_enum";`);
  }
}
