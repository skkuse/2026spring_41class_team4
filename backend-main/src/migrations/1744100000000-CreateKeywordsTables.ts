import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKeywordsTables1744100000000 implements MigrationInterface {
  name = 'CreateKeywordsTables1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keywords" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subjectId" uuid NOT NULL,
        "name" varchar(150) NOT NULL,
        "importanceScore" double precision,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_keywords_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_keywords_subjectId_name'
        ) THEN
          ALTER TABLE "keywords"
          ADD CONSTRAINT "UQ_keywords_subjectId_name" UNIQUE ("subjectId", "name");
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
          WHERE conname = 'FK_keywords_subjectId'
        ) THEN
          ALTER TABLE "keywords"
          ADD CONSTRAINT "FK_keywords_subjectId"
          FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_keywords_subjectId"
      ON "keywords" ("subjectId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_keywords" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "keywordId" uuid NOT NULL,
        "importanceScore" double precision,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_keywords_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_document_keywords_documentId_keywordId'
        ) THEN
          ALTER TABLE "document_keywords"
          ADD CONSTRAINT "UQ_document_keywords_documentId_keywordId"
          UNIQUE ("documentId", "keywordId");
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
          WHERE conname = 'FK_document_keywords_documentId'
        ) THEN
          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "document_keywords"
            ADD CONSTRAINT "FK_document_keywords_documentId"
            FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE;
          ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
            ALTER TABLE "document_keywords"
            ADD CONSTRAINT "FK_document_keywords_documentId"
            FOREIGN KEY ("documentId") REFERENCES "document_entity"("id") ON DELETE CASCADE;
          ELSE
            RAISE NOTICE 'Skipping FK_document_keywords_documentId because neither documents nor document_entity exists.';
          END IF;
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
          WHERE conname = 'FK_document_keywords_keywordId'
        ) THEN
          ALTER TABLE "document_keywords"
          ADD CONSTRAINT "FK_document_keywords_keywordId"
          FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_keywords_documentId"
      ON "document_keywords" ("documentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_keywords_keywordId"
      ON "document_keywords" ("keywordId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "document_keywords" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "keywords" CASCADE');
  }
}
