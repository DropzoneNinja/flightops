import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEquipmentTables1773200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "equipment_engines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "tank_size_litres" float,
        "fuel_consumption_lph" float,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_engines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_engines_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_engines_user_id" ON "equipment_engines" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_wings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "manufacturer" varchar(255),
        "model" varchar(255),
        "size" varchar(50),
        "trim_speed_kmh" float,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_wings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_wings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_wings_user_id" ON "equipment_wings" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_paramotors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "engine_id" uuid,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_paramotors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_paramotors_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_equipment_paramotors_engine" FOREIGN KEY ("engine_id")
          REFERENCES "equipment_engines"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_paramotors_user_id" ON "equipment_paramotors" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_paramotors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_wings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_engines"`);
  }
}
