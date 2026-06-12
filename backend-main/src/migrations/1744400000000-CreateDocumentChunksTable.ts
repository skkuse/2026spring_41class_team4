import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentChunksTable1744400000000 implements MigrationInterface {
  name = 'CreateDocumentChunksTable1744400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "page_number" integer NOT NULL,
        "heading" varchar(255),
        "content" text NOT NULL,
        "visual_note" text,
        "display_order" integer NOT NULL,
        "token_count" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_chunks_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_document_chunks_document_id_page_number'
        ) THEN
          ALTER TABLE "document_chunks"
          ADD CONSTRAINT "UQ_document_chunks_document_id_page_number"
          UNIQUE ("document_id", "page_number");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_document_chunks_document_id'
        ) THEN
          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "document_chunks"
            ADD CONSTRAINT "FK_document_chunks_document_id"
            FOREIGN KEY ("document_id")
            REFERENCES "documents"("id")
            ON DELETE CASCADE;
          ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
            ALTER TABLE "document_chunks"
            ADD CONSTRAINT "FK_document_chunks_document_id"
            FOREIGN KEY ("document_id")
            REFERENCES "document_entity"("id")
            ON DELETE CASCADE;
          ELSE
            RAISE NOTICE 'Skipping FK_document_chunks_document_id because neither documents nor document_entity exists.';
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_chunks_document_id_display_order"
      ON "document_chunks" ("document_id", "display_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "document_chunks" CASCADE');
  }
}
