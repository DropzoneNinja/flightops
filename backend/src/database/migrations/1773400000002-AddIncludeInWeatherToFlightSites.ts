import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIncludeInWeatherToFlightSites1773400000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'flight_sites',
      new TableColumn({
        name: 'include_in_weather',
        type: 'boolean',
        default: true,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('flight_sites', 'include_in_weather');
  }
}
