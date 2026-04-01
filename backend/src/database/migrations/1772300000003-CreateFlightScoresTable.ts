import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateFlightScoresTable1772300000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'flight_scores',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'flight_id', type: 'uuid', isNullable: false, isUnique: true },
          { name: 'scoring_version', type: 'varchar', length: '50', isNullable: false },
          { name: 'overall_score', type: 'float', isNullable: false },
          { name: 'takeoff_score', type: 'float', isNullable: true },
          { name: 'climb_score', type: 'float', isNullable: true },
          { name: 'level_score', type: 'float', isNullable: true },
          { name: 'turn_score', type: 'float', isNullable: true },
          { name: 'descent_score', type: 'float', isNullable: true },
          { name: 'landing_score', type: 'float', isNullable: true },
          { name: 'smoothness_score', type: 'float', isNullable: true },
          { name: 'safety_score', type: 'float', isNullable: true },
          { name: 'explanation_json', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'flight_scores',
      new TableForeignKey({
        name: 'FK_FLIGHT_SCORES_FLIGHT_ID',
        columnNames: ['flight_id'],
        referencedTableName: 'flights',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('flight_scores', 'FK_FLIGHT_SCORES_FLIGHT_ID');
    await queryRunner.dropTable('flight_scores');
  }
}
