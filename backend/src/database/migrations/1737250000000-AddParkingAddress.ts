import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParkingAddress1737250000000 implements MigrationInterface {
    name = 'AddParkingAddress1737250000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD "parking_address" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP COLUMN "parking_address"`);
    }

}
