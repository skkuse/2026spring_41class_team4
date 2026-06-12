import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizAttemptsTables1744900000000 implements MigrationInterface {
  name = 'CreateQuizAttemptsTables1744900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
          CREATE TYPE "attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "attempt_status" NOT NULL,
        "started_at" TIMESTAMP NOT NULL,
        "submitted_at" TIMESTAMP,
        "total_quiz_problems" integer,
        "correct_count" integer,
        "score" decimal(5,2),
        "feedback" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_attempts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_attempts_quiz_id'
        ) THEN
          ALTER TABLE "quiz_attempts"
          ADD CONSTRAINT "FK_quiz_attempts_quiz_id"
          FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_attempts_user_id'
        ) THEN
          ALTER TABLE "quiz_attempts"
          ADD CONSTRAINT "FK_quiz_attempts_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_attempts_quiz_id"
      ON "quiz_attempts" ("quiz_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_attempts_user_id"
      ON "quiz_attempts" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_problem_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quiz_attempt_id" uuid NOT NULL,
        "quiz_problem_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "user_answer" text,
        "is_correct" boolean,
        "used_hint" boolean NOT NULL DEFAULT false,
        "hint_level_used" integer,
        "elapsed_seconds" integer,
        "feedback" text,
        "submitted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_problem_attempts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_quiz_problem_attempts_quiz_attempt_id_quiz_problem_id'
        ) THEN
          ALTER TABLE "quiz_problem_attempts"
          ADD CONSTRAINT "UQ_quiz_problem_attempts_quiz_attempt_id_quiz_problem_id"
          UNIQUE ("quiz_attempt_id", "quiz_problem_id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_attempts_quiz_attempt_id'
        ) THEN
          ALTER TABLE "quiz_problem_attempts"
          ADD CONSTRAINT "FK_quiz_problem_attempts_quiz_attempt_id"
          FOREIGN KEY ("quiz_attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_attempts_quiz_problem_id'
        ) THEN
          ALTER TABLE "quiz_problem_attempts"
          ADD CONSTRAINT "FK_quiz_problem_attempts_quiz_problem_id"
          FOREIGN KEY ("quiz_problem_id") REFERENCES "quiz_problems"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_quiz_problem_attempts_user_id'
        ) THEN
          ALTER TABLE "quiz_problem_attempts"
          ADD CONSTRAINT "FK_quiz_problem_attempts_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_problem_attempts_quiz_attempt_id"
      ON "quiz_problem_attempts" ("quiz_attempt_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_problem_attempts_quiz_problem_id"
      ON "quiz_problem_attempts" ("quiz_problem_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_problem_attempts_user_id"
      ON "quiz_problem_attempts" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "quiz_problem_attempts" DROP CONSTRAINT IF EXISTS "FK_quiz_problem_attempts_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "quiz_problem_attempts" DROP CONSTRAINT IF EXISTS "FK_quiz_problem_attempts_quiz_problem_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "quiz_problem_attempts" DROP CONSTRAINT IF EXISTS "FK_quiz_problem_attempts_quiz_attempt_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "quiz_problem_attempts" DROP CONSTRAINT IF EXISTS "UQ_quiz_problem_attempts_quiz_attempt_id_quiz_problem_id"',
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quiz_problem_attempts_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quiz_problem_attempts_quiz_problem_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quiz_problem_attempts_quiz_attempt_id"');

    await queryRunner.query('DROP TABLE IF EXISTS "quiz_problem_attempts" CASCADE');

    await queryRunner.query(
      'ALTER TABLE "quiz_attempts" DROP CONSTRAINT IF EXISTS "FK_quiz_attempts_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "quiz_attempts" DROP CONSTRAINT IF EXISTS "FK_quiz_attempts_quiz_id"',
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quiz_attempts_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quiz_attempts_quiz_id"');

    await queryRunner.query('DROP TABLE IF EXISTS "quiz_attempts" CASCADE');

    await queryRunner.query('DROP TYPE IF EXISTS "attempt_status"');
  }
}
