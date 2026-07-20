import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Equipment restructure for API v2.0:
 * - New equipment_reserves table (4th equipment category).
 * - Fuel tank size moves from engine to paramotor (backfilled from linked engine).
 * - Paramotor <-> Wing becomes many-to-many via equipment_paramotor_wings,
 *   with a per-pairing fuel_burn_lph. Engine fuel columns are dropped
 *   (fuel_consumption_lph has no wing pairing to map to and is discarded).
 * - Optional paramotor -> reserve link (0..1).
 * - Wing gains a free-text color column.
 * - Maintenance record tables: engine services, wing inspections,
 *   reserve packs, reserve inspections (all cascade-deleted with parent).
 *
 * down() is lossy: fuel_consumption_lph cannot be restored, and tank size
 * restore is best-effort when multiple paramotors share an engine.
 */
export class RestructureEquipmentV21773600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "equipment_reserves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "manufacturer" varchar(255),
        "model" varchar(255),
        "size" varchar(50),
        "base_hours" float NOT NULL DEFAULT 0,
        "total_hours" float NOT NULL DEFAULT 0,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_reserves" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_reserves_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_reserves_user_id" ON "equipment_reserves" ("user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "equipment_paramotors"
        ADD COLUMN "tank_size_litres" float,
        ADD COLUMN "reserve_id" uuid,
        ADD CONSTRAINT "FK_equipment_paramotors_reserve" FOREIGN KEY ("reserve_id")
          REFERENCES "equipment_reserves"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      UPDATE "equipment_paramotors" p
        SET "tank_size_litres" = e."tank_size_litres"
        FROM "equipment_engines" e
        WHERE p."engine_id" = e."id" AND e."tank_size_litres" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_paramotor_wings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paramotor_id" uuid NOT NULL,
        "wing_id" uuid NOT NULL,
        "fuel_burn_lph" float,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_paramotor_wings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_equipment_paramotor_wings" UNIQUE ("paramotor_id", "wing_id"),
        CONSTRAINT "FK_epw_paramotor" FOREIGN KEY ("paramotor_id")
          REFERENCES "equipment_paramotors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_epw_wing" FOREIGN KEY ("wing_id")
          REFERENCES "equipment_wings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_epw_paramotor_id" ON "equipment_paramotor_wings" ("paramotor_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_epw_wing_id" ON "equipment_paramotor_wings" ("wing_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "equipment_engines"
        DROP COLUMN "tank_size_litres",
        DROP COLUMN "fuel_consumption_lph"
    `);

    await queryRunner.query(`
      ALTER TABLE "equipment_wings" ADD COLUMN "color" varchar(255)
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_engine_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "engine_id" uuid NOT NULL,
        "service_date" date NOT NULL,
        "service_type" varchar(255) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_engine_services" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_engine_services_engine" FOREIGN KEY ("engine_id")
          REFERENCES "equipment_engines"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_engine_services_engine_id"
        ON "equipment_engine_services" ("engine_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_wing_inspections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "wing_id" uuid NOT NULL,
        "inspection_date" date NOT NULL,
        "inspection_type" varchar(255) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_wing_inspections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_wing_inspections_wing" FOREIGN KEY ("wing_id")
          REFERENCES "equipment_wings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_wing_inspections_wing_id"
        ON "equipment_wing_inspections" ("wing_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_reserve_packs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reserve_id" uuid NOT NULL,
        "pack_date" date NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_reserve_packs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_reserve_packs_reserve" FOREIGN KEY ("reserve_id")
          REFERENCES "equipment_reserves"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_reserve_packs_reserve_id"
        ON "equipment_reserve_packs" ("reserve_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "equipment_reserve_inspections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reserve_id" uuid NOT NULL,
        "inspection_date" date NOT NULL,
        "inspection_type" varchar(255) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equipment_reserve_inspections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_equipment_reserve_inspections_reserve" FOREIGN KEY ("reserve_id")
          REFERENCES "equipment_reserves"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_equipment_reserve_inspections_reserve_id"
        ON "equipment_reserve_inspections" ("reserve_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_reserve_inspections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_reserve_packs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_wing_inspections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_engine_services"`);

    await queryRunner.query(`ALTER TABLE "equipment_wings" DROP COLUMN "color"`);

    await queryRunner.query(`
      ALTER TABLE "equipment_engines"
        ADD COLUMN "tank_size_litres" float,
        ADD COLUMN "fuel_consumption_lph" float
    `);

    await queryRunner.query(`
      UPDATE "equipment_engines" e
        SET "tank_size_litres" = p."tank_size_litres"
        FROM "equipment_paramotors" p
        WHERE p."engine_id" = e."id" AND p."tank_size_litres" IS NOT NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_paramotor_wings"`);

    await queryRunner.query(`
      ALTER TABLE "equipment_paramotors"
        DROP CONSTRAINT "FK_equipment_paramotors_reserve",
        DROP COLUMN "reserve_id",
        DROP COLUMN "tank_size_litres"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_reserves"`);
  }
}
