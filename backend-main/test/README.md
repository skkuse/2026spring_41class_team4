# Backend 테스트 가이드

테스트 레이어별 배치 (NestJS 컨벤션 준수 — 단위 테스트는 소스 옆에 둔다):

| 레벨 | 위치 | 네이밍 | 의존성 |
|---|---|---|---|
| **Unit** | `src/**` 소스 옆 co-located | `*.spec.ts` | 전부 mock (repo는 `getRepositoryToken` mock) |
| **Integration** | `test/integration/**` | `*.int-spec.ts` | 실제 DB 또는 일부 실제 모듈 |
| **e2e** | `test/` | `*.e2e-spec.ts` | 앱 전체 부팅 (supertest) |

> 단위 테스트를 `test/`로 옮기지 않는 이유: NestJS 기본 컨벤션이자 이 repo의 `AGENTS.md`("Keep unit tests beside the code they cover when practical")를 따른다. `test/`에는 상위 레벨(integration/e2e)만 둔다.

## 실행 (원할 때 직접 실행)

| 명령 | 대상 | 설정 |
|---|---|---|
| `npm test` | 단위 테스트 전체 (`src/**/*.spec.ts`) | package.json `jest` (rootDir=src) |
| `npm run test:watch` | 단위 watch | 〃 |
| `npm run test:cov` | 단위 + 커버리지 (`coverage/`) | 〃 |
| `npm run test:integration` | 통합 테스트 (supertest + 실제 DB) | `test/jest-integration.json` |
| `npm run test:e2e` | e2e | `test/jest-e2e.json` |

> CI/git hook은 두지 않는다. 특정 파일만: `npm test -- src/quiz/quiz-target-selector.service.spec.ts`

### 통합 테스트 전제조건 (최초 1회)

통합 테스트는 실제 AppModule을 부팅해 **테스트 전용 DB `sudocampus_test`**(자동 생성·마이그레이션)와 supertest로 HTTP 계약을 검증한다.

1. 로컬 Postgres 기동: 루트에서 `docker compose up -d db`
2. role에 DB 생성 권한 부여 (최초 1회):
   ```bash
   docker exec ai-tutor-postgres psql -U postgres -c "ALTER ROLE sudocampus_user CREATEDB;"
   ```
3. **java 런타임 필요** — PDF 업로드 경로가 `@opendataloader/pdf` jar를 spawn한다 (`docs/environment.md` Runtime Prerequisites).

구조: `setup-env.ts`(.env 로드 + DB_NAME 오버라이드) → `global-setup.ts`(DB 생성 + migration) → `helpers.ts`(`createTestingApp`/`createAndLoginTestUser`/`truncateAllTables`). 유저는 DB 시딩 + 실제 `/auth/login`으로 토큰을 받는다(SMTP 불필요). 스크립트의 `--experimental-vm-modules`는 Nest `FileTypeValidator`의 ESM(`file-type`) 동적 import를 jest에서 동작시키기 위한 것 — 빼면 모든 업로드가 검증 실패로 위양성 400이 난다.

## 새 단위 테스트 템플릿 (NestJS service, co-located)

`src/<module>/<name>.service.ts` 옆에 `src/<module>/<name>.service.spec.ts`로 둔다.
기존 `src/subjects/subjects.service.spec.ts` / `src/quiz/quiz-target-selector.service.spec.ts`와 동일 패턴, **상대경로 import**.

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Thing } from './entities/thing.entity';
import { ThingService } from './thing.service';

describe('ThingService', () => {
  let service: ThingService;
  const repository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThingService,
        { provide: getRepositoryToken(Thing), useValue: repository },
      ],
    }).compile();
    service = module.get(ThingService);
  });

  it('does the thing', async () => {
    repository.findOne.mockResolvedValue({ id: '1' });
    await expect(service.get('1')).resolves.toEqual({ id: '1' });
  });
});
```

## TDD 워크플로

1. **Red** — 기대 동작을 먼저 `it('...')`로 작성하고 실패시킨다.
   범위가 큰 항목은 `it.todo('...')`로 백로그에 남긴다 (`test/integration/keyword-document-isolation.int-spec.ts` 참고).
2. **Green** — 통과할 최소 구현.
3. **Refactor** — 초록 유지하며 정리.

전체 계획·우선순위는 `docs/backend-tdd-plan.md` 참고.

## 명세 항목 ↔ 테스트 매핑

`document/06-implementation-status.md`의 회귀 위험 항목과 이를 고정하는 테스트.

| Status 항목 | 규칙 | 테스트 | 상태 |
|---|---|---|---|
| 3 | mastery는 `(user_id, keyword_id)`로만 조회 (subject_id 금지) | `src/quiz/quiz-target-selector.service.spec.ts` | ✅ green |
| 4 / 9 | 선택 keywordIds는 대상 document 소속이어야 함 | `src/quiz/quiz-target-selector.service.spec.ts` | ✅ green |
| 4 / 9 | quiz 생성 시 타 document keyword 거부 (통합, 실 DB) | `test/integration/keyword-document-isolation.int-spec.ts` | ✅ green |
| 9 | 동명 keyword의 document 간 격리 (통합, 실 DB) | `test/integration/keyword-document-isolation.int-spec.ts` | ✅ green |
| 8 | subject keyword는 documents 조인 집계 + documentId 노출 | `test/integration/keyword-document-isolation.int-spec.ts` | ✅ green |
| 9 | upload→analyze 임계 경로 (OpenAI 의존) | `test/integration/keyword-document-isolation.int-spec.ts` | 🔴 todo |
| — | 업로드 파일 검증 매트릭스 (확장자/스푸핑/50MB/고아 방지) | `test/integration/document-upload-validation.int-spec.ts` | ✅ green (9) |

새 spec을 추가하면 이 표도 갱신한다.
