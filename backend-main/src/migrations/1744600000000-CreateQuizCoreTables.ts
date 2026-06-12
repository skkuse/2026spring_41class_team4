import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizCoreTables1744600000000 implements MigrationInterface {
  name = 'CreateQuizCoreTables1744600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_type') THEN
          CREATE TYPE "quiz_type" AS ENUM ('LECTURE', 'MOCK_EXAM');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_problem_type') THEN
          CREATE TYPE "quiz_problem_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
          CREATE TYPE "difficulty_level" AS ENUM ('EASY', 'MEDIUM', 'HARD');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quizzes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id" uuid NOT NULL,
        "document_id" uuid,
        "user_id" uuid NOT NULL,
        "quiz_type" "quiz_type" NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "quiz_problem_count" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quizzes_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quizzes_subject_id'
        ) THEN
          ALTER TABLE "quizzes"
          ADD CONSTRAINT "FK_quizzes_subject_id"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quizzes_document_id'
        ) THEN
          IF to_regclass('public.documents') IS NOT NULL THEN
            ALTER TABLE "quizzes"
            ADD CONSTRAINT "FK_quizzes_document_id"
            FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL;
          ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
            ALTER TABLE "quizzes"
            ADD CONSTRAINT "FK_quizzes_document_id"
            FOREIGN KEY ("document_id") REFERENCES "document_entity"("id") ON DELETE SET NULL;
          ELSE
            RAISE NOTICE 'Skipping FK_quizzes_document_id because neither documents nor document_entity exists.';
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quizzes_user_id'
        ) THEN
          ALTER TABLE "quizzes"
          ADD CONSTRAINT "FK_quizzes_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quizzes_subject_id"
      ON "quizzes" ("subject_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quizzes_document_id"
      ON "quizzes" ("document_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quizzes_user_id"
      ON "quizzes" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_problems" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_id" uuid NOT NULL,
        "problem_text" text NOT NULL,
        "quiz_problem_type" "quiz_problem_type" NOT NULL,
        "answer_text" text NOT NULL,
        "explanation" text,
        "difficulty" "difficulty_level" NOT NULL,
        "hint_level_1" text,
        "hint_level_2" text,
        "hint_level_3" text,
        "display_order" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_problems_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problems_quiz_id'
        ) THEN
          ALTER TABLE "quiz_problems"
          ADD CONSTRAINT "FK_quiz_problems_quiz_id"
          FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_problems_quiz_id_display_order"
      ON "quiz_problems" ("quiz_id", "display_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_problem_choices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_problem_id" uuid NOT NULL,
        "choice_text" text NOT NULL,
        "is_correct" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_problem_choices_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_choices_quiz_problem_id'
        ) THEN
          ALTER TABLE "quiz_problem_choices"
          ADD CONSTRAINT "FK_quiz_problem_choices_quiz_problem_id"
          FOREIGN KEY ("quiz_problem_id") REFERENCES "quiz_problems"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_problem_choices_quiz_problem_id_display_order"
      ON "quiz_problem_choices" ("quiz_problem_id", "display_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_problem_keywords" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_problem_id" uuid NOT NULL,
        "keyword_id" uuid NOT NULL,
        "weight" decimal(5,4),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_problem_keywords_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_quiz_problem_keywords_quiz_problem_id_keyword_id'
        ) THEN
          ALTER TABLE "quiz_problem_keywords"
          ADD CONSTRAINT "UQ_quiz_problem_keywords_quiz_problem_id_keyword_id"
          UNIQUE ("quiz_problem_id", "keyword_id");
        END IF;
      END
      $$;
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
        IF NOT EXISTS (
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
    await queryRunner.query(
      'ALTER TABLE "quiz_problem_keywords" DROP CONSTRAINT IF EXISTS "FK_quiz_problem_keywords_quiz_problem_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "quiz_problem_choices" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "quiz_problems" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "quizzes" CASCADE');
    await queryRunner.query('DROP TYPE IF EXISTS "difficulty_level"');
    await queryRunner.query('DROP TYPE IF EXISTS "quiz_problem_type"');
    await queryRunner.query('DROP TYPE IF EXISTS "quiz_type"');
  }
}
