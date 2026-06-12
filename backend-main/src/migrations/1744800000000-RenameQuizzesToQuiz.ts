import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameQuizzesToQuiz1744800000000 implements MigrationInterface {
  name = 'RenameQuizzesToQuiz1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quizzes') IS NOT NULL
          AND to_regclass('public.quiz') IS NULL THEN
          ALTER TABLE "quizzes" RENAME TO "quiz";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "PK_quizzes_id" TO "PK_quiz_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quizzes_subject_id" TO "FK_quiz_subject_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quizzes_document_id" TO "FK_quiz_document_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quizzes_user_id" TO "FK_quiz_user_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quizzes_subject_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quizzes_subject_id" RENAME TO "IDX_quiz_subject_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quizzes_document_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quizzes_document_id" RENAME TO "IDX_quiz_document_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quizzes_user_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quizzes_user_id" RENAME TO "IDX_quiz_user_id";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quiz_subject_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quiz_subject_id" RENAME TO "IDX_quizzes_subject_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quiz_document_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quiz_document_id" RENAME TO "IDX_quizzes_document_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public."IDX_quiz_user_id"') IS NOT NULL THEN
          ALTER INDEX "IDX_quiz_user_id" RENAME TO "IDX_quizzes_user_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quiz_subject_id" TO "FK_quizzes_subject_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quiz_document_id" TO "FK_quizzes_document_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "FK_quiz_user_id" TO "FK_quizzes_user_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL THEN
          ALTER TABLE "quiz" RENAME CONSTRAINT "PK_quiz_id" TO "PK_quizzes_id";
        END IF;
      EXCEPTION WHEN undefined_object THEN
        NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.quiz') IS NOT NULL
          AND to_regclass('public.quizzes') IS NULL THEN
          ALTER TABLE "quiz" RENAME TO "quizzes";
        END IF;
      END
      $$;
    `);
  }
}
