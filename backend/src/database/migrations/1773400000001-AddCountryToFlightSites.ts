import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCountryToFlightSites1773400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'flight_sites',
      new TableColumn({
        name: 'country',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('flight_sites', 'country');
  }
}
