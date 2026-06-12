import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignDocumentIdToUuid1744200000000 implements MigrationInterface {
  name = 'AlignDocumentIdToUuid1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        invalid_count integer;
        doc_table text;
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          doc_table := 'documents';
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          doc_table := 'document_entity';
        END IF;

        IF doc_table IS NOT NULL THEN
          EXECUTE format(
            'SELECT COUNT(*) FROM %I WHERE "id" IS NOT NULL AND "id"::text !~* %L',
            doc_table,
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          ) INTO invalid_count;

          IF invalid_count > 0 THEN
            RAISE EXCEPTION 'Cannot cast %.id to uuid. Invalid row count: %', doc_table, invalid_count;
          END IF;
        END IF;

        IF to_regclass('public.document_keywords') IS NOT NULL THEN
          SELECT COUNT(*) INTO invalid_count
          FROM "document_keywords"
          WHERE "documentId" IS NOT NULL
            AND "documentId"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

          IF invalid_count > 0 THEN
            RAISE EXCEPTION 'Cannot cast document_keywords.documentId to uuid. Invalid row count: %', invalid_count;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        IF to_regclass('public.document_keywords') IS NULL THEN
          RETURN;
        END IF;

        FOR constraint_name IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'document_keywords'
            AND c.contype = 'f'
        LOOP
          EXECUTE format(
            'ALTER TABLE "document_keywords" DROP CONSTRAINT IF EXISTS %I',
            constraint_name
          );
        END LOOP;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        doc_table text;
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          doc_table := 'documents';
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          doc_table := 'document_entity';
        END IF;

        IF doc_table IS NOT NULL THEN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = doc_table
              AND column_name = 'id'
              AND data_type <> 'uuid'
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I ALTER COLUMN "id" TYPE uuid USING "id"::uuid',
              doc_table
            );
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL THEN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_keywords'
              AND column_name = 'documentId'
              AND data_type <> 'uuid'
          ) THEN
            ALTER TABLE "document_keywords"
            ALTER COLUMN "documentId" TYPE uuid
            USING "documentId"::uuid;
          END IF;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        doc_table text;
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          doc_table := 'documents';
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          doc_table := 'document_entity';
        END IF;

        IF to_regclass('public.document_keywords') IS NOT NULL
           AND doc_table IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM pg_constraint
             WHERE conname = 'FK_document_keywords_documentId'
           ) THEN
          EXECUTE format(
            'ALTER TABLE "document_keywords"
             ADD CONSTRAINT "FK_document_keywords_documentId"
             FOREIGN KEY ("documentId") REFERENCES %I("id") ON DELETE CASCADE',
            doc_table
          );
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL THEN
          ALTER TABLE "document_keywords"
          DROP CONSTRAINT IF EXISTS "FK_document_keywords_documentId";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        doc_table text;
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          doc_table := 'documents';
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          doc_table := 'document_entity';
        END IF;

        IF doc_table IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = doc_table
               AND column_name = 'id'
               AND data_type = 'uuid'
           ) THEN
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "id" TYPE varchar USING "id"::text',
            doc_table
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.document_keywords') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'document_keywords'
               AND column_name = 'documentId'
               AND data_type = 'uuid'
           ) THEN
          ALTER TABLE "document_keywords"
          ALTER COLUMN "documentId" TYPE varchar
          USING "documentId"::text;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        doc_table text;
      BEGIN
        IF to_regclass('public.documents') IS NOT NULL THEN
          doc_table := 'documents';
        ELSIF to_regclass('public.document_entity') IS NOT NULL THEN
          doc_table := 'document_entity';
        END IF;

        IF to_regclass('public.document_keywords') IS NOT NULL
           AND doc_table IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM pg_constraint
             WHERE conname = 'FK_document_keywords_documentId'
           ) THEN
          EXECUTE format(
            'ALTER TABLE "document_keywords"
             ADD CONSTRAINT "FK_document_keywords_documentId"
             FOREIGN KEY ("documentId") REFERENCES %I("id") ON DELETE CASCADE',
            doc_table
          );
        END IF;
      END
      $$;
    `);
  }
}

