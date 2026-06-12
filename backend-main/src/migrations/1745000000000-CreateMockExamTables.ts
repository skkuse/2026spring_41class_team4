import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMockExamTables1745000000000 implements MigrationInterface {
  name = 'CreateMockExamTables1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_exams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "quiz_problem_count" integer NOT NULL,
        "target_weak_keywords" boolean NOT NULL,
        "generated_from_mastery" boolean NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mock_exams_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_mock_exams_quiz_id'
        ) THEN
          ALTER TABLE "mock_exams"
          ADD CONSTRAINT "UQ_mock_exams_quiz_id"
          UNIQUE ("quiz_id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mock_exams_quiz_id'
        ) THEN
          ALTER TABLE "mock_exams"
          ADD CONSTRAINT "FK_mock_exams_quiz_id"
          FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mock_exams_subject_id'
        ) THEN
          ALTER TABLE "mock_exams"
          ADD CONSTRAINT "FK_mock_exams_subject_id"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mock_exams_user_id'
        ) THEN
          ALTER TABLE "mock_exams"
          ADD CONSTRAINT "FK_mock_exams_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mock_exams_subject_id"
      ON "mock_exams" ("subject_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mock_exams_user_id"
      ON "mock_exams" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_exam_problems" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mock_exam_id" uuid NOT NULL,
        "quiz_problem_id" uuid NOT NULL,
        "display_order" integer NOT NULL,
        CONSTRAINT "PK_mock_exam_problems_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_mock_exam_problems_mock_exam_id_quiz_problem_id'
        ) THEN
          ALTER TABLE "mock_exam_problems"
          ADD CONSTRAINT "UQ_mock_exam_problems_mock_exam_id_quiz_problem_id"
          UNIQUE ("mock_exam_id", "quiz_problem_id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mock_exam_problems_mock_exam_id'
        ) THEN
          ALTER TABLE "mock_exam_problems"
          ADD CONSTRAINT "FK_mock_exam_problems_mock_exam_id"
          FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_mock_exam_problems_quiz_problem_id'
        ) THEN
          ALTER TABLE "mock_exam_problems"
          ADD CONSTRAINT "FK_mock_exam_problems_quiz_problem_id"
          FOREIGN KEY ("quiz_problem_id") REFERENCES "quiz_problems"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mock_exam_problems_mock_exam_id"
      ON "mock_exam_problems" ("mock_exam_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mock_exam_problems_quiz_problem_id"
      ON "mock_exam_problems" ("quiz_problem_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "mock_exam_problems" DROP CONSTRAINT IF EXISTS "FK_mock_exam_problems_quiz_problem_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "mock_exam_problems" DROP CONSTRAINT IF EXISTS "FK_mock_exam_problems_mock_exam_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "mock_exam_problems" DROP CONSTRAINT IF EXISTS "UQ_mock_exam_problems_mock_exam_id_quiz_problem_id"',
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_mock_exam_problems_quiz_problem_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_mock_exam_problems_mock_exam_id"');

    await queryRunner.query('DROP TABLE IF EXISTS "mock_exam_problems" CASCADE');

    await queryRunner.query(
      'ALTER TABLE "mock_exams" DROP CONSTRAINT IF EXISTS "FK_mock_exams_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "mock_exams" DROP CONSTRAINT IF EXISTS "FK_mock_exams_subject_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "mock_exams" DROP CONSTRAINT IF EXISTS "FK_mock_exams_quiz_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "mock_exams" DROP CONSTRAINT IF EXISTS "UQ_mock_exams_quiz_id"',
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_mock_exams_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_mock_exams_subject_id"');

    await queryRunner.query('DROP TABLE IF EXISTS "mock_exams" CASCADE');
  }
}
