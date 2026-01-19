import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlotDataToFlightSites1737350000000 implements MigrationInterface {
    name = 'AddPlotDataToFlightSites1737350000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD "plot_data" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP COLUMN "plot_data"`);
    }

}
