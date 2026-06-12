import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorDocumentScopedKeywords1744300000000 implements MigrationInterface {
  name = 'RefactorDocumentScopedKeywords1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.keywords') IS NULL THEN
          CREATE TABLE "keywords" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "document_id" uuid,
            "name" varchar(100) NOT NULL,
            "description" text,
            "importance_score" decimal(5,4),
            "is_learning_objective_core" boolean NOT NULL DEFAULT false,
            "appears_multiple_times" boolean NOT NULL DEFAULT false,
            "is_prerequisite_for_other_concepts" boolean NOT NULL DEFAULT false,
            "is_used_in_assessment" boolean NOT NULL DEFAULT false,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_keywords_id" PRIMARY KEY ("id")
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "document_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "description" text
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "importance_score" decimal(5,4)
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "is_learning_objective_core" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "appears_multiple_times" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "is_prerequisite_for_other_concepts" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "is_used_in_assessment" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'keywords'
            AND column_name = 'importanceScore'
        ) THEN
          UPDATE "keywords"
          SET "importance_score" = COALESCE(
            "importance_score",
            LEAST(GREATEST("importanceScore"::numeric, 0), 1)
          )
          WHERE "importanceScore" IS NOT NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'keywords'
            AND column_name = 'createdAt'
        ) THEN
          UPDATE "keywords"
          SET "created_at" = COALESCE("created_at", "createdAt");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'keywords'
            AND column_name = 'updatedAt'
        ) THEN
          UPDATE "keywords"
          SET "updated_at" = COALESCE("updated_at", "updatedAt");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL THEN
          UPDATE "keywords" k
          SET "document_id" = pick."documentId"
          FROM (
            SELECT DISTINCT ON (dk."keywordId")
              dk."keywordId",
              dk."documentId"
            FROM "document_keywords" dk
            ORDER BY dk."keywordId", dk."createdAt" ASC, dk."id" ASC
          ) pick
          WHERE k."id" = pick."keywordId"
            AND k."document_id" IS NULL;

          /*
            Legacy model allowed one keyword row to be linked to multiple documents.
            To preserve document context, clone additional rows for non-primary mappings.
          */
          INSERT INTO "keywords" (
            "id",
            "document_id",
            "name",
            "description",
            "importance_score",
            "is_learning_objective_core",
            "appears_multiple_times",
            "is_prerequisite_for_other_concepts",
            "is_used_in_assessment",
            "created_at",
            "updated_at"
          )
          SELECT
            uuid_generate_v4(),
            dk."documentId",
            k."name",
            k."description",
            k."importance_score",
            k."is_learning_objective_core",
            k."appears_multiple_times",
            k."is_prerequisite_for_other_concepts",
            k."is_used_in_assessment",
            k."created_at",
            k."updated_at"
          FROM "document_keywords" dk
          JOIN "keywords" k
            ON k."id" = dk."keywordId"
          WHERE k."document_id" IS DISTINCT FROM dk."documentId";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "document_id", "name"
            ORDER BY "created_at" ASC, "id" ASC
          ) AS rn
        FROM "keywords"
        WHERE "document_id" IS NOT NULL
      )
      DELETE FROM "keywords"
      WHERE id IN (
        SELECT id
        FROM ranked
        WHERE rn > 1
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_keywords_subjectId"`);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP CONSTRAINT IF EXISTS "FK_keywords_subjectId"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP CONSTRAINT IF EXISTS "UQ_keywords_subjectId_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP CONSTRAINT IF EXISTS "UQ_keywords_documentId_name"
    `);

    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP COLUMN IF EXISTS "subjectId"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP COLUMN IF EXISTS "subject_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP COLUMN IF EXISTS "importanceScore"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP COLUMN IF EXISTS "createdAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP COLUMN IF EXISTS "updatedAt"
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        missing_document_count bigint;
      BEGIN
        SELECT COUNT(*) INTO missing_document_count
        FROM "keywords"
        WHERE "document_id" IS NULL;

        IF missing_document_count = 0 THEN
          ALTER TABLE "keywords"
          ALTER COLUMN "document_id" SET NOT NULL;
        ELSE
          RAISE NOTICE 'keywords.document_id still has % NULL rows; NOT NULL constraint skipped for safety', missing_document_count;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          ALTER TABLE "keywords"
          DROP CONSTRAINT IF EXISTS "FK_keywords_document_id";
          ALTER TABLE "keywords"
          ADD CONSTRAINT "FK_keywords_document_id"
          FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "keywords"
          DROP CONSTRAINT IF EXISTS "FK_keywords_document_id";
          ALTER TABLE "keywords"
          ADD CONSTRAINT "FK_keywords_document_id"
          FOREIGN KEY ("document_id") REFERENCES "document_entity"("id") ON DELETE CASCADE;
        ELSE
          RAISE NOTICE 'Neither documents nor document_entity table exists. FK_keywords_document_id was not created.';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        duplicate_count bigint;
      BEGIN
        SELECT COUNT(*) INTO duplicate_count
        FROM (
          SELECT "document_id", "name"
          FROM "keywords"
          GROUP BY "document_id", "name"
          HAVING COUNT(*) > 1
        ) dup;

        IF duplicate_count = 0 THEN
          ALTER TABLE "keywords"
          ADD CONSTRAINT "UQ_keywords_document_id_name"
          UNIQUE ("document_id", "name");
        ELSE
          RAISE EXCEPTION 'Cannot create UQ_keywords_document_id_name due to % duplicate groups', duplicate_count;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_keywords_document_id"
      ON "keywords" ("document_id")
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "document_keywords" CASCADE`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mastery_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "keyword_id" uuid NOT NULL,
        "mastery_score" decimal(5,4) NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "correct_count" integer NOT NULL DEFAULT 0,
        "recent_correct_rate" decimal(5,4),
        "difficulty_weighted_score" decimal(5,4),
        "no_hint_bonus" decimal(5,4),
        "last_attempted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mastery_scores_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mastery_scores_user_id_keyword_id" UNIQUE ("user_id", "keyword_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mastery_scores_user_id'
        ) THEN
          ALTER TABLE "mastery_scores"
          ADD CONSTRAINT "FK_mastery_scores_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mastery_scores_keyword_id'
        ) THEN
          ALTER TABLE "mastery_scores"
          ADD CONSTRAINT "FK_mastery_scores_keyword_id"
          FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_problem_keywords" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_problem_id" uuid NOT NULL,
        "keyword_id" uuid NOT NULL,
        "weight" decimal(5,4),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_problem_keywords_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quiz_problem_keywords_quiz_problem_id_keyword_id"
          UNIQUE ("quiz_problem_id", "keyword_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_keywords_keyword_id'
        ) THEN
          ALTER TABLE "quiz_problem_keywords"
          ADD CONSTRAINT "FK_quiz_problem_keywords_keyword_id"
          FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz_problems') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_keywords_quiz_problem_id'
           ) THEN
          ALTER TABLE "quiz_problem_keywords"
          ADD CONSTRAINT "FK_quiz_problem_keywords_quiz_problem_id"
          FOREIGN KEY ("quiz_problem_id") REFERENCES "quiz_problems"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

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
      INSERT INTO "document_keywords" (
        "id",
        "documentId",
        "keywordId",
        "importanceScore",
        "createdAt",
        "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        "document_id",
        "id",
        "importance_score"::double precision,
        "created_at",
        "updated_at"
      FROM "keywords"
      WHERE "document_id" IS NOT NULL
      ON CONFLICT ("documentId", "keywordId") DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP CONSTRAINT IF EXISTS "UQ_keywords_document_id_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "keywords"
      DROP CONSTRAINT IF EXISTS "FK_keywords_document_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_keywords_document_id"`);

    await queryRunner.query(`
      ALTER TABLE "keywords"
      ADD COLUMN IF NOT EXISTS "subjectId" uuid
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_problem_keywords" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mastery_scores" CASCADE`);
  }
}
