import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMissionWaypointsTable1772400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'mission_waypoints',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'mission_id', type: 'uuid', isNullable: false },
          { name: 'sort_order', type: 'int', isNullable: false },
          {
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'longitude',
            type: 'decimal',
            precision: 11,
            scale: 8,
            isNullable: false,
          },
          { name: 'altitude', type: 'float', isNullable: true },
          { name: 'planned_speed', type: 'float', isNullable: true },
          { name: 'leg_minutes', type: 'float', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamp', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'mission_waypoints',
      new TableIndex({
        name: 'IDX_MISSION_WAYPOINTS_MISSION_ID_SORT_ORDER',
        columnNames: ['mission_id', 'sort_order'],
      }),
    );

    await queryRunner.createForeignKey(
      'mission_waypoints',
      new TableForeignKey({
        name: 'FK_MISSION_WAYPOINTS_MISSION_ID',
        columnNames: ['mission_id'],
        referencedTableName: 'missions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('mission_waypoints', 'FK_MISSION_WAYPOINTS_MISSION_ID');
    await queryRunner.dropIndex('mission_waypoints', 'IDX_MISSION_WAYPOINTS_MISSION_ID_SORT_ORDER');
    await queryRunner.dropTable('mission_waypoints');
  }
}
