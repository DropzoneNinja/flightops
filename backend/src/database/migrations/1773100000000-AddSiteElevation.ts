import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSiteElevation1773100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'flight_sites',
      new TableColumn({
        name: 'elevation_m',
        type: 'integer',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('flight_sites', 'elevation_m');
  }
}
