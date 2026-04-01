import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateFlightEventsTable1772300000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'flight_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'flight_id', type: 'uuid', isNullable: false },
          { name: 'event_type', type: 'varchar', length: '100', isNullable: false },
          { name: 'timestamp', type: 'timestamp', isNullable: true },
          { name: 'seq_start', type: 'int', isNullable: true },
          { name: 'seq_end', type: 'int', isNullable: true },
          { name: 'lon', type: 'float', isNullable: true },
          { name: 'lat', type: 'float', isNullable: true },
          { name: 'elevation_m', type: 'float', isNullable: true },
          { name: 'confidence', type: 'float', isNullable: true },
          { name: 'payload_json', type: 'jsonb', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'flight_events',
      new TableIndex({ name: 'IDX_FLIGHT_EVENTS_FLIGHT_ID', columnNames: ['flight_id'] }),
    );

    await queryRunner.createForeignKey(
      'flight_events',
      new TableForeignKey({
        name: 'FK_FLIGHT_EVENTS_FLIGHT_ID',
        columnNames: ['flight_id'],
        referencedTableName: 'flights',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('flight_events', 'FK_FLIGHT_EVENTS_FLIGHT_ID');
    await queryRunner.dropIndex('flight_events', 'IDX_FLIGHT_EVENTS_FLIGHT_ID');
    await queryRunner.dropTable('flight_events');
  }
}
