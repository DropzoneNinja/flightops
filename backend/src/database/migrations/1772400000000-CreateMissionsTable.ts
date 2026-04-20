import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMissionsTable1772400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'missions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'launch_site_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'missions',
      new TableIndex({ name: 'IDX_MISSIONS_NAME', columnNames: ['name'] }),
    );
    await queryRunner.createIndex(
      'missions',
      new TableIndex({ name: 'IDX_MISSIONS_LAUNCH_SITE_ID', columnNames: ['launch_site_id'] }),
    );
    await queryRunner.createIndex(
      'missions',
      new TableIndex({ name: 'IDX_MISSIONS_UPDATED_AT', columnNames: ['updated_at'] }),
    );

    await queryRunner.createForeignKey(
      'missions',
      new TableForeignKey({
        name: 'FK_MISSIONS_LAUNCH_SITE_ID',
        columnNames: ['launch_site_id'],
        referencedTableName: 'flight_sites',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('missions', 'FK_MISSIONS_LAUNCH_SITE_ID');
    await queryRunner.dropIndex('missions', 'IDX_MISSIONS_UPDATED_AT');
    await queryRunner.dropIndex('missions', 'IDX_MISSIONS_LAUNCH_SITE_ID');
    await queryRunner.dropIndex('missions', 'IDX_MISSIONS_NAME');
    await queryRunner.dropTable('missions');
  }
}
