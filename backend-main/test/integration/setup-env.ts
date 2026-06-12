/**
 * jest setupFiles — 모든 int-spec 모듈이 import되기 전에 실행된다.
 * backend/.env를 로드(data-source.ts와 동일한 trim 파서)한 뒤
 * DB_NAME만 테스트 전용 DB로 강제해 dev 데이터 오염을 막는다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
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

process.env.NODE_ENV = 'test';
// 통합 테스트는 항상 별도 DB를 사용한다 (global-setup.ts가 생성·마이그레이션).
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'sudocampus_test';
// 참고: 문서(AGENTS.md)상의 mock fallback 플래그 — 현재 코드엔 미구현(ISSUE-010).
// 통합 테스트는 AI 경계를 overrideProvider로 대체하므로 의존하지 않는다.
process.env.OPENAI_ALLOW_MOCK_ON_ERROR = 'true';
