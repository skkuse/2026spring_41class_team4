import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthzAndDocumentOwnership1741000000000
  implements MigrationInterface
{
  name = 'AddAuthzAndDocumentOwnership1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
          CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'USER'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "status" "user_status" NOT NULL DEFAULT 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.documents') IS NULL
           AND to_regclass('public.document_entity') IS NULL THEN
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
        IF to_regclass('public.documents') IS NOT NULL THEN
          ALTER TABLE "documents"
          ADD COLUMN IF NOT EXISTS "ownerUserId" uuid;
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "document_entity"
          ADD COLUMN IF NOT EXISTS "ownerUserId" uuid;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          ALTER TABLE "documents"
          DROP COLUMN IF EXISTS "ownerUserId";
        END IF;

        IF to_regclass('public.document_entity') IS NOT NULL THEN
          ALTER TABLE "document_entity"
          DROP COLUMN IF EXISTS "ownerUserId";
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "token_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "status"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "role"
    `);
    await queryRunner.query('DROP TYPE IF EXISTS "user_status"');
    await queryRunner.query('DROP TYPE IF EXISTS "user_role"');
  }
}
