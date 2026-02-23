import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddSiteIdToMedia1740200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add site_id column
    await queryRunner.addColumn(
      'media',
      new TableColumn({
        name: 'site_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Create index on site_id
    await queryRunner.createIndex(
      'media',
      new TableIndex({
        name: 'IDX_MEDIA_SITE_ID',
        columnNames: ['site_id'],
      }),
    );

    // Create foreign key to flight_sites table
    await queryRunner.createForeignKey(
      'media',
      new TableForeignKey({
        name: 'FK_MEDIA_SITE',
        columnNames: ['site_id'],
        referencedTableName: 'flight_sites',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('media', 'FK_MEDIA_SITE');

    // Drop index
    await queryRunner.dropIndex('media', 'IDX_MEDIA_SITE_ID');

    // Drop column
    await queryRunner.dropColumn('media', 'site_id');
  }
}
