/**
 * jest globalSetup — 테스트 DB(sudocampus_test)가 없으면 만들고
 * 마이그레이션을 최신까지 적용한다. 전제: 로컬 Postgres 기동
 * (루트 docker-compose `db`) + role에 CREATEDB 권한
 * (`ALTER ROLE <user> CREATEDB;` — test/README.md 참고).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

function loadDotEnv(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export default async function globalSetup(): Promise<void> {
  loadDotEnv();
  const testDbName = process.env.TEST_DB_NAME ?? 'sudocampus_test';

  // 1) 테스트 DB가 없으면 생성 (기본 'postgres' DB로 접속해서 확인).
  const admin = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${testDbName}"`);
    }
  } finally {
    await admin.end();
  }

  // 2) 테스트 DB에 마이그레이션 적용 — DB_NAME을 env로 주입해 typeorm CLI 실행.
  //    (src/data-source.ts의 .env 파서는 이미 설정된 env를 덮어쓰지 않는다.)
  execSync(
    'node -r ts-node/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts',
    {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, DB_NAME: testDbName },
    },
  );
}
