import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotesToFlightSites1767602176416 implements MigrationInterface {
    name = 'AddNotesToFlightSites1767602176416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD "takeoff_notes" text`);
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD "parking_notes" text`);
        await queryRunner.query(`ALTER TABLE "flight_sites" ADD "weather_notes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP COLUMN "weather_notes"`);
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP COLUMN "parking_notes"`);
        await queryRunner.query(`ALTER TABLE "flight_sites" DROP COLUMN "takeoff_notes"`);
    }

}
