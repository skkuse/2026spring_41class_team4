import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNativeAuthVerificationFoundation1743000000000
  implements MigrationInterface
{
  name = 'AddNativeAuthVerificationFoundation1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_purpose') THEN
          CREATE TYPE "verification_purpose" AS ENUM ('SIGNUP_VERIFICATION', 'PASSWORD_RESET');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_delivery_channel') THEN
          CREATE TYPE "verification_delivery_channel" AS ENUM ('EMAIL', 'SMS');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_credentials_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_password_credentials_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_password_credentials_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_verification_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "email" varchar(255) NOT NULL,
        "purpose" "verification_purpose" NOT NULL,
        "code_hash" varchar(255) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "verified_at" TIMESTAMP,
        "consumed_at" TIMESTAMP,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "delivery_channel" "verification_delivery_channel" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_verification_codes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_verification_codes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_verification_codes_email_purpose"
      ON "auth_verification_codes" ("email", "purpose")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_verification_codes_code_hash"
      ON "auth_verification_codes" ("code_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_verification_codes_expires_at"
      ON "auth_verification_codes" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_auth_verification_codes_expires_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_auth_verification_codes_code_hash"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_auth_verification_codes_email_purpose"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "auth_verification_codes"');
    await queryRunner.query('DROP TABLE IF EXISTS "password_credentials"');
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "email_verified_at"
    `);
    await queryRunner.query('DROP TYPE IF EXISTS "verification_delivery_channel"');
    await queryRunner.query('DROP TYPE IF EXISTS "verification_purpose"');
  }
}
