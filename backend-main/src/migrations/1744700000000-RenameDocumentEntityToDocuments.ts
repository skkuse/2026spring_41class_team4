import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameDocumentEntityToDocuments1744700000000
  implements MigrationInterface
{
  name = 'RenameDocumentEntityToDocuments1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.documents') IS NULL
           AND to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "document_entity" RENAME TO "documents";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.documents') IS NULL THEN
          CREATE TABLE "documents" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "ownerUserId" uuid,
            "subjectId" uuid,
            "originalFileName" varchar(255),
            "title" varchar(255),
            "fileUrl" varchar(500),
            "outputDir" text,
            "jsonFiles" text,
            "markdownFiles" text,
            "imageFiles" text,
            "analysisStatus" varchar(20) NOT NULL DEFAULT 'UPLOADED',
            "overallSummary" text,
            "analysisErrorMessage" text,
            "generationStatus" varchar NOT NULL DEFAULT 'uploaded',
            "totalPages" integer NOT NULL DEFAULT 0,
            "pageCount" integer NOT NULL DEFAULT 0,
            "processedPages" integer NOT NULL DEFAULT 0,
            "failedPages" integer NOT NULL DEFAULT 0,
            "lastError" text,
            "generationStartedAt" TIMESTAMP,
            "generationCompletedAt" TIMESTAMP,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_chunks') IS NOT NULL THEN
          ALTER TABLE "document_chunks"
          DROP CONSTRAINT IF EXISTS "FK_document_chunks_document_id";

          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "document_chunks"
            ADD CONSTRAINT "FK_document_chunks_document_id"
            FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.keywords') IS NOT NULL THEN
          ALTER TABLE "keywords"
          DROP CONSTRAINT IF EXISTS "FK_keywords_document_id";

          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "keywords"
            ADD CONSTRAINT "FK_keywords_document_id"
            FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL THEN
          ALTER TABLE "document_keywords"
          DROP CONSTRAINT IF EXISTS "FK_document_keywords_documentId";

          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "document_keywords"
            ADD CONSTRAINT "FK_document_keywords_documentId"
            FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quizzes') IS NOT NULL THEN
          ALTER TABLE "quizzes"
          DROP CONSTRAINT IF EXISTS "FK_quizzes_document_id";

          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "quizzes"
            ADD CONSTRAINT "FK_quizzes_document_id"
            FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL;
          END IF;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quizzes') IS NOT NULL
           AND to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "quizzes"
          DROP CONSTRAINT IF EXISTS "FK_quizzes_document_id";
          ALTER TABLE "quizzes"
          ADD CONSTRAINT "FK_quizzes_document_id"
          FOREIGN KEY ("document_id") REFERENCES "document_entity"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL
           AND to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "document_keywords"
          DROP CONSTRAINT IF EXISTS "FK_document_keywords_documentId";
          ALTER TABLE "document_keywords"
          ADD CONSTRAINT "FK_document_keywords_documentId"
          FOREIGN KEY ("documentId") REFERENCES "document_entity"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.keywords') IS NOT NULL
           AND to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "keywords"
          DROP CONSTRAINT IF EXISTS "FK_keywords_document_id";
          ALTER TABLE "keywords"
          ADD CONSTRAINT "FK_keywords_document_id"
          FOREIGN KEY ("document_id") REFERENCES "document_entity"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_chunks') IS NOT NULL
           AND to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "document_chunks"
          DROP CONSTRAINT IF EXISTS "FK_document_chunks_document_id";
          ALTER TABLE "document_chunks"
          ADD CONSTRAINT "FK_document_chunks_document_id"
          FOREIGN KEY ("document_id") REFERENCES "document_entity"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_entity') IS NULL
           AND to_regclass('public.documents') IS NOT NULL THEN
          ALTER TABLE "documents" RENAME TO "document_entity";
        END IF;
      END
      $$;
    `);
  }
}

