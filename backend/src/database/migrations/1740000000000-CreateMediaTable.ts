import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMediaTable1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create media_type enum
    await queryRunner.query(`
      CREATE TYPE "media_type_enum" AS ENUM('image', 'video');
    `);

    // Create media table
    await queryRunner.createTable(
      new Table({
        name: 'media',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'flight_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'media_type',
            type: 'media_type_enum',
            isNullable: false,
          },
          {
            name: 'file_path',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'original_filename',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'uploaded_by',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'pilots',
            type: 'text[]',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'mime_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'thumbnail_path',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create index on flight_date for efficient date-based queries
    await queryRunner.createIndex(
      'media',
      new TableIndex({
        name: 'IDX_MEDIA_FLIGHT_DATE',
        columnNames: ['flight_date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.dropIndex('media', 'IDX_MEDIA_FLIGHT_DATE');

    // Drop table
    await queryRunner.dropTable('media');

    // Drop enum
    await queryRunner.query(`
      DROP TYPE "media_type_enum";
    `);
  }
}
