import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAltitudeToPilots1773500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'pilots',
      new TableColumn({
        name: 'altitude_m',
        type: 'float',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pilots', 'altitude_m');
  }
}
