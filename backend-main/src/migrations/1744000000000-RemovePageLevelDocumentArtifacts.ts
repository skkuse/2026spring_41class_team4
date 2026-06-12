import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePageLevelDocumentArtifacts1744000000000
  implements MigrationInterface
{
  name = 'RemovePageLevelDocumentArtifacts1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop dependents first and use CASCADE to handle legacy FK variants.
    await queryRunner.query('DROP TABLE IF EXISTS "page_quiz" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "page_quizzes" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "page_summary" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "page_summaries" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "page_keyword" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "page_keywords" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "document_page" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "document_pages" CASCADE');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz_problems') IS NOT NULL
           OR to_regclass('quiz_problems') IS NOT NULL THEN
          ALTER TABLE "quiz_problems"
          DROP COLUMN IF EXISTS "source_document_page_id";
        END IF;

        IF to_regclass('public.quiz_problem') IS NOT NULL
           OR to_regclass('quiz_problem') IS NOT NULL THEN
          ALTER TABLE "quiz_problem"
          DROP COLUMN IF EXISTS "source_document_page_id";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz_problems') IS NOT NULL
           OR to_regclass('quiz_problems') IS NOT NULL THEN
          ALTER TABLE "quiz_problems"
          ADD COLUMN IF NOT EXISTS "source_document_page_id" uuid;
        END IF;

        IF to_regclass('public.quiz_problem') IS NOT NULL
           OR to_regclass('quiz_problem') IS NOT NULL THEN
          ALTER TABLE "quiz_problem"
          ADD COLUMN IF NOT EXISTS "source_document_page_id" uuid;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "page_number" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_pages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "page_summaries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_page_id" uuid NOT NULL,
        "summary" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_page_summaries_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "page_keywords" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_page_id" uuid NOT NULL,
        "keyword_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_page_keywords_id" PRIMARY KEY ("id")
      )
    `);
  }
}
