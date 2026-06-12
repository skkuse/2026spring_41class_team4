import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKeywordChunksTable1744500000000 implements MigrationInterface {
  name = 'CreateKeywordChunksTable1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keyword_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "keyword_id" uuid NOT NULL,
        "document_chunk_id" uuid NOT NULL,
        "relevance_score" decimal(5,4),
        "evidence_text" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_keyword_chunks_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_keyword_chunks_keyword_id_document_chunk_id'
        ) THEN
          ALTER TABLE "keyword_chunks"
          ADD CONSTRAINT "UQ_keyword_chunks_keyword_id_document_chunk_id"
          UNIQUE ("keyword_id", "document_chunk_id");
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
          WHERE conname = 'FK_keyword_chunks_keyword_id'
        ) THEN
          ALTER TABLE "keyword_chunks"
          ADD CONSTRAINT "FK_keyword_chunks_keyword_id"
          FOREIGN KEY ("keyword_id")
          REFERENCES "keywords"("id")
          ON DELETE CASCADE;
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
          WHERE conname = 'FK_keyword_chunks_document_chunk_id'
        ) THEN
          ALTER TABLE "keyword_chunks"
          ADD CONSTRAINT "FK_keyword_chunks_document_chunk_id"
          FOREIGN KEY ("document_chunk_id")
          REFERENCES "document_chunks"("id")
          ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_keyword_chunks_keyword_id"
      ON "keyword_chunks" ("keyword_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_keyword_chunks_document_chunk_id"
      ON "keyword_chunks" ("document_chunk_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "keyword_chunks" CASCADE');
  }
}
