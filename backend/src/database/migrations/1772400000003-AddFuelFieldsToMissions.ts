import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFuelFieldsToMissions1772400000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'missions',
      new TableColumn({ name: 'avg_fuel_consumption', type: 'float', isNullable: true }),
    );
    await queryRunner.addColumn(
      'missions',
      new TableColumn({ name: 'fuel_tank_size', type: 'float', isNullable: true }),
    );
    await queryRunner.addColumn(
      'missions',
      new TableColumn({ name: 'wind_direction', type: 'float', isNullable: true }),
    );
    await queryRunner.addColumn(
      'missions',
      new TableColumn({ name: 'wind_speed', type: 'float', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('missions', 'wind_speed');
    await queryRunner.dropColumn('missions', 'wind_direction');
    await queryRunner.dropColumn('missions', 'fuel_tank_size');
    await queryRunner.dropColumn('missions', 'avg_fuel_consumption');
  }
}
