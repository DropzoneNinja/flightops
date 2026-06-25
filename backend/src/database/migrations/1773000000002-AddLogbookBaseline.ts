import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddLogbookBaseline1773000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'logbook_baselines',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'pilot_id', type: 'uuid', isNullable: false },
          { name: 'prior_flights', type: 'int', default: 0, isNullable: false },
          { name: 'prior_duration_seconds', type: 'int', isNullable: true },
          { name: 'prior_distance_m', type: 'float', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'logbook_baselines',
      new TableIndex({ name: 'IDX_LOGBOOK_BASELINE_PILOT', columnNames: ['pilot_id'] }),
    );

    await queryRunner.createIndex(
      'logbook_baselines',
      new TableIndex({ name: 'UQ_LOGBOOK_BASELINE_PILOT', columnNames: ['pilot_id'], isUnique: true }),
    );

    await queryRunner.createForeignKey(
      'logbook_baselines',
      new TableForeignKey({
        name: 'FK_LOGBOOK_BASELINE_PILOT',
        columnNames: ['pilot_id'],
        referencedTableName: 'pilots',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('logbook_baselines', 'FK_LOGBOOK_BASELINE_PILOT');
    await queryRunner.dropIndex('logbook_baselines', 'UQ_LOGBOOK_BASELINE_PILOT');
    await queryRunner.dropIndex('logbook_baselines', 'IDX_LOGBOOK_BASELINE_PILOT');
    await queryRunner.dropTable('logbook_baselines');
  }
}
