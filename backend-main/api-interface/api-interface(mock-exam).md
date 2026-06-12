# SudoCampus Mock Exam API Interface

- 작성일: 2026-06-05
- 기준 코드:
  - `src/mock-exam/mock-exam.controller.ts`
  - `src/mock-exam/mock-exam.service.ts`
  - `src/mock-exam/dto/create-mock-exam.dto.ts`
  - `src/mock-exam/dto/create-mock-exam-response.dto.ts`
  - `src/mock-exam/dto/mock-exam-list-response.dto.ts`
  - `src/quiz/quiz.service.ts`
  - `src/quiz-attempts/quiz-attempts.service.ts`

이 문서는 현재 구현된 Mock Exam API 계약을 FE 공유용으로 정리한다.

## 1) 공통 규칙

- 인증 필요: `Authorization: Bearer <accessToken>`
- `subjectId` path param은 UUID v4여야 한다.
- subject 기반 API는 현재 로그인한 사용자의 subject만 접근할 수 있다.
- subject가 없거나 현재 사용자 소유가 아니면 `404 Subject not found.`를 반환한다.
- Mock exam 문제 풀이는 기존 quiz/attempt API를 재사용한다.
- `GET /quiz/:quizId` solving view는 `answerText`, `choices[].isCorrect`를 노출하지 않는다.

## 2) API 목록

| Method | Endpoint | Status | Description |
| --- | --- | --- | --- |
| `POST` | `/subjects/:subjectId/mock-exams` | LIVE | 과목 기반 개인화 모의고사 생성 |
| `GET` | `/subjects/:subjectId/mock-exams` | LIVE | 과목에 생성된 모의고사 목록 및 최근 풀이 결과 조회 |

## 3) TypeScript Interface

```ts
export type QuizType = 'LECTURE' | 'MOCK_EXAM';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface CreateMockExamRequest {
  quizProblemCount: number; // required, 1~50
  documentIds?: string[]; // optional, UUID v4 array, unique
  targetWeakKeywords?: boolean; // optional, default true
  keywordIds?: string[]; // optional, UUID v4 array, unique
}

export interface CreateMockExamResponse {
  mockExamId: string;
  quizId: string;
  quizType: 'MOCK_EXAM';
  quizProblemCount: number;
}

export interface MockExamLatestAttempt {
  attemptId: string;
  status: AttemptStatus;
  startedAt: string; // ISO datetime
  submittedAt: string | null; // ISO datetime
  totalQuizProblems: number | null;
  correctCount: number | null;
  score: number | null;
}

export interface MockExamListItem {
  mockExamId: string;
  quizId: string;
  subjectId: string;
  title: string;
  quizProblemCount: number;
  targetWeakKeywords: boolean;
  generatedFromMastery: boolean;
  createdAt: string; // ISO datetime
  latestAttempt: MockExamLatestAttempt | null;
}
```

## 4) POST `/subjects/:subjectId/mock-exams`

현재 사용자의 subject에 속한 문서, 키워드, mastery를 기반으로 모의고사를 생성한다.

### Request

```json
{
  "quizProblemCount": 5,
  "documentIds": ["9d8d4f6f-5947-41cb-9c6d-536e9388339e"],
  "targetWeakKeywords": true,
  "keywordIds": []
}
```

### Request fields

| Field | Required | Description |
| --- | --- | --- |
| `quizProblemCount` | Yes | 생성할 문제 수. `1~50` |
| `documentIds` | No | 범위를 제한할 document ID 목록. 제공 시 모두 현재 user/subject 소유이고 `ANALYZED` 상태여야 한다. |
| `targetWeakKeywords` | No | `true`이면 weak keyword를 우선 선택한다. 기본값은 `true` |
| `keywordIds` | No | 우선 사용할 keyword ID 목록. 제공 시 selected document scope 안에 있어야 한다. |

### Response

```json
{
  "mockExamId": "2d3ecf9f-6b28-4713-8b0d-4ba9f41df76c",
  "quizId": "798b50bc-a3e4-47a3-b7c2-e2d3aa77c755",
  "quizType": "MOCK_EXAM",
  "quizProblemCount": 5
}
```

## 5) GET `/subjects/:subjectId/mock-exams`

현재 사용자의 subject에 생성된 모든 mock exam 목록을 최신 생성순으로 조회한다.

### Query behavior

- `JwtAuthGuard` 적용
- `SubjectsService.findOne(userId, subjectId)`로 subject ownership 검증
- `mock_exams`와 `quiz`를 조인
- `mock_exams.user_id = currentUser.id`
- `mock_exams.subject_id = subjectId`
- `quiz.user_id = currentUser.id`
- `quiz.subject_id = subjectId`
- `quiz.quiz_type = MOCK_EXAM`
- `mock_exams.created_at DESC` 정렬
- 각 mock exam의 최근 attempt 1건을 `latestAttempt`로 포함

### Response

```json
[
  {
    "mockExamId": "2d3ecf9f-6b28-4713-8b0d-4ba9f41df76c",
    "quizId": "798b50bc-a3e4-47a3-b7c2-e2d3aa77c755",
    "subjectId": "8613eb58-cb7f-4b81-bc4e-22dc3f6da42b",
    "title": "Computer Networks Mock Exam",
    "quizProblemCount": 5,
    "targetWeakKeywords": true,
    "generatedFromMastery": true,
    "createdAt": "2026-06-05T05:12:30.000Z",
    "latestAttempt": {
      "attemptId": "4ac2d828-c0bb-44aa-a34e-4f207dd9a120",
      "status": "GRADED",
      "startedAt": "2026-06-05T05:15:00.000Z",
      "submittedAt": "2026-06-05T05:25:00.000Z",
      "totalQuizProblems": 5,
      "correctCount": 4,
      "score": 80
    }
  },
  {
    "mockExamId": "c20ed826-f878-4c55-b7a9-6a4c553fc90d",
    "quizId": "7339c33a-8c27-40da-9a7c-52d8bf764c90",
    "subjectId": "8613eb58-cb7f-4b81-bc4e-22dc3f6da42b",
    "title": "Computer Networks Mock Exam",
    "quizProblemCount": 10,
    "targetWeakKeywords": true,
    "generatedFromMastery": true,
    "createdAt": "2026-06-04T09:00:00.000Z",
    "latestAttempt": null
  }
]
```

### Response fields

| Field | Description |
| --- | --- |
| `mockExamId` | `mock_exams.id` |
| `quizId` | 연결된 `quiz.id`. 문제 풀이 화면은 `GET /quiz/:quizId`를 호출한다. |
| `subjectId` | subject ID |
| `title` | `quiz.title` |
| `quizProblemCount` | 생성된 문제 수 |
| `targetWeakKeywords` | weak keyword 우선 생성 여부 |
| `generatedFromMastery` | mastery 기반 생성 여부 |
| `createdAt` | mock exam 생성 시각 |
| `latestAttempt` | 현재 사용자의 해당 quiz 최근 풀이 결과. 풀이 기록이 없으면 `null` |

## 6) Selection Policy

Keyword selection order:

1. Explicit `keywordIds`
2. Weak keywords where `masteryScore < 0.4`
3. Keywords with no mastery score
4. Remaining keywords ordered by `importanceScore DESC`

Additional rules:

- If `documentIds` are provided, keyword selection is limited to those documents.
- If `documentIds` are omitted, keyword selection uses all documents under the subject.
- Explicit `keywordIds` must belong to the selected scope.
- Explicit `keywordIds` must have source chunks.
- Source chunks are loaded through `keyword_chunks -> document_chunks`.

## 7) Persistence

The server saves the following in a single TypeORM transaction:

- `quiz` with `quiz_type = MOCK_EXAM`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `mock_exams`
- `mock_exam_problems`

If `mock_exams` or `mock_exam_problems` save fails, the underlying `MOCK_EXAM` quiz and quiz problem rows are rolled back.

## 8) Error Guide

| Status | Case |
| --- | --- |
| `400` | invalid body validation |
| `400` | selected `documentIds` do not all belong to current user and subject |
| `400` | selected `documentIds` are not all `ANALYZED` |
| `400` | no documents/keywords/source chunks available in selected scope |
| `400` | explicit `keywordIds` are outside selected scope |
| `401` | missing or invalid token |
| `404` | subject not found or not owned by current user |

## 9) Follow-up Flow

From a mock exam list item:

1. Use `quizId` for `GET /quiz/:quizId`
2. Start solving with `POST /quiz/:quizId/attempts`
3. Submit answers with `POST /attempts/:attemptId/answers`
4. Finalize with `POST /attempts/:attemptId/submit`
5. Show detailed review with `GET /attempts/:attemptId/review`

The list API only includes the latest attempt summary. Detailed per-problem result data should be fetched through `GET /attempts/:attemptId/review`.
