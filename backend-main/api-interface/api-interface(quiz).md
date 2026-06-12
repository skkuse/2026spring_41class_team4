# SudoCampus Quiz API / DTO 명세 (공유용)

- 작성일: 2026-06-01
- 기준 코드:
  - `src/quiz/quiz.controller.ts`
  - `src/quiz/quiz.service.ts`
  - `src/quiz/quiz-target-selector.service.ts`
  - `src/quiz/dto/*.ts`
  - `src/quiz/enums/*.ts`

이 문서는 현재 백엔드에 구현된 Quiz 관련 API와 DTO를 팀 공유용으로 정리한 문서입니다.
현재 문서는 Quiz 생성, 문서별 Quiz 목록 조회, 풀이 화면 조회 API를 포함한다.
답안 제출, 채점, 리뷰, mastery 갱신 API는 QuizAttempt 모듈에서 별도 제공 예정이다.

## 1) 공통 규칙

- 모든 Quiz API는 인증 필요 (`Authorization: Bearer <accessToken>`)
- 모든 path param ID는 UUID 형식만 허용
  - `documentId: uuid`
  - `quizId: uuid`
- ValidationPipe 설정
  - `whitelist: true`
  - `forbidNonWhitelisted: true`

---

## 2) API 목록 (현재 구현)

1. `POST /documents/:documentId/quiz`
2. `GET /documents/:documentId/quiz`
3. `GET /quiz/:quizId`

---

## 3) Enum 명세

```ts
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export type QuizProblemType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'SHORT_ANSWER';

export type QuizType = 'LECTURE' | 'MOCK_EXAM';
```

---

## 4) DTO 명세

### CreateDocumentQuizDto

```ts
interface CreateDocumentQuizDto {
  quizProblemCount: number; // required, int, 1~50
  keywordIds?: string[]; // optional, UUID v4 array, unique
}
```

검증 규칙:
- `quizProblemCount`: `@IsInt`, `@Min(1)`, `@Max(50)`
- `keywordIds`: `@IsArray`, `@ArrayUnique`, `@IsUUID('4', { each: true })`

### CreateQuizResponseDto

```ts
interface CreateQuizResponseDto {
  quizId: string;
  quizType: 'LECTURE' | 'MOCK_EXAM';
  quizProblemCount: number;
}
```

### QuizSolvingViewResponseDto

```ts
interface QuizSolvingChoiceDto {
  id: string;
  choiceText: string;
  displayOrder: number;
}

interface QuizSolvingProblemDto {
  id: string;
  problemText: string;
  quizProblemType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  displayOrder: number;
  hintLevel1: string | null;
  hintLevel2: string | null;
  hintLevel3: string | null;
  choices: QuizSolvingChoiceDto[];
}

interface QuizSolvingViewResponseDto {
  id: string;
  title: string;
  quizType: 'LECTURE' | 'MOCK_EXAM';
  quizProblems: QuizSolvingProblemDto[];
}
```

### DocumentQuizListItemDto

```ts
interface DocumentQuizLatestAttemptDto {
  attemptId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  startedAt: string; // ISO datetime
  submittedAt: string | null; // ISO datetime
  totalQuizProblems: number | null;
  correctCount: number | null;
  score: number | null;
}

interface DocumentQuizListItemDto {
  quizId: string;
  title: string;
  quizType: 'LECTURE' | 'MOCK_EXAM';
  quizProblemCount: number | null;
  createdAt: string; // ISO datetime
  latestAttempt: DocumentQuizLatestAttemptDto | null;
}
```

중요:
- 풀이 화면 API(`GET /quiz/:quizId`)는 정답 정보(`answerText`, `isCorrect`)를 내려주지 않음
- 문서별 Quiz 목록 API(`GET /documents/:documentId/quiz`)는 문제별 상세/리뷰 정보를 내려주지 않음

---

## 5) API 상세

### 5.1 POST `/documents/:documentId/quiz`

문서 기반 강의 퀴즈 생성.

- Path param
  - `documentId: uuid`
- Body (`application/json`)

```json
{
  "quizProblemCount": 10,
  "keywordIds": [
    "77822867-a290-4243-8270-8f092db8a6e1",
    "5abf4f7d-1a2a-4f53-b8d1-9de63c302ed5"
  ]
}
```

Response:

```json
{
  "quizId": "e66b6919-9fcf-4588-8bf1-1f0ef828f7b0",
  "quizType": "LECTURE",
  "quizProblemCount": 10
}
```

서버 동작 요약:
- 문서 소유권 확인
- 문서 분석 상태(`ANALYZED`) 확인
- 키워드/청크 타겟 선정
  - 난이도는 사용자 masteryScore 기반으로 서버가 자동 결정
- AI 퀴즈 생성
- 검증 후 `quiz`, `quiz_problems`, `quiz_problem_choices`, `quiz_problem_keywords` 저장

---

### 5.2 GET `/documents/:documentId/quiz`

문서에 생성된 퀴즈 목록 조회.

- Path param
  - `documentId: uuid`

Response 예시:

```json
[
  {
    "quizId": "e66b6919-9fcf-4588-8bf1-1f0ef828f7b0",
    "title": "T4_1강 Quiz",
    "quizType": "LECTURE",
    "quizProblemCount": 10,
    "createdAt": "2026-06-01T10:00:00.000Z",
    "latestAttempt": {
      "attemptId": "4bd1b0b1-1da8-41f9-96fb-5bcf5d26f4a4",
      "status": "GRADED",
      "startedAt": "2026-06-01T10:05:00.000Z",
      "submittedAt": "2026-06-01T10:15:00.000Z",
      "totalQuizProblems": 10,
      "correctCount": 7,
      "score": 70
    }
  }
]
```

서버 동작 요약:
- 문서 소유권 확인
- `quiz.document_id = documentId` 및 `quiz.user_id = currentUser.id`인 퀴즈만 조회
- 각 퀴즈별 현재 사용자의 가장 최근 `quiz_attempts` 요약 포함
- 문제별 상세 리뷰는 `GET /attempts/:attemptId/review` 사용

---

### 5.3 GET `/quiz/:quizId`

퀴즈 풀이 화면용 조회.

- Path param
  - `quizId: uuid`

Response 예시:

```json
{
  "id": "e66b6919-9fcf-4588-8bf1-1f0ef828f7b0",
  "title": "T4_1강 Quiz",
  "quizType": "LECTURE",
  "quizProblems": [
    {
      "id": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
      "problemText": "다음 중 폭포수 모델의 특징으로 가장 적절한 것은?",
      "quizProblemType": "SINGLE_CHOICE",
      "difficulty": "EASY",
      "displayOrder": 1,
      "hintLevel1": "개발 단계를 순차적으로 떠올려보세요.",
      "hintLevel2": null,
      "hintLevel3": null,
      "choices": [
        {
          "id": "842357cf-8b53-43e1-b26b-438198e915f9",
          "choiceText": "단계를 반복적으로 역방향으로 이동한다",
          "displayOrder": 1
        },
        {
          "id": "6c3dbccf-0197-45b3-8c89-d6d8e0c3a77d",
          "choiceText": "각 단계가 완료된 뒤 다음 단계로 진행한다",
          "displayOrder": 2
        }
      ]
    }
  ]
}
```

주의:
- 문제/선택지 정렬은 `displayOrder` 오름차순으로 반환됨
- 정답/해설 원문(`answerText`, `isCorrect`)은 반환하지 않음

---

## 6) 에러 코드 가이드

- `400`
  - path/body validation 실패 (UUID 형식 오류, quizProblemCount 범위 오류 등)
  - 비즈니스 검증 실패:
    - 문서가 `ANALYZED` 상태가 아님
    - 문서에 키워드 없음
    - 선택 keywordIds가 문서 소속이 아님
    - 키워드-청크 매핑 없음
    - AI 생성 결과가 요청 수량/형식 조건 불만족
- `401`: 인증 실패
- `403`: 소유권 없음 (타 사용자 문서/퀴즈)
- `404`: 문서/퀴즈 없음
- `500`: 저장 시점 내부 오류(예: 트랜잭션 중 대상 문서 조회 불가)
- `503`: OpenAI 퀴즈 생성 실패

---

## 7) FE 연동 체크포인트

- `POST /documents/:documentId/quiz` 호출 전 문서 상태가 `ANALYZED`인지 확인 필요
- `keywordIds` 미전송 시 서버가 문서 전체 키워드에서 자동 선별
- `GET /quiz/:quizId` 응답은 풀이용이므로 정답 데이터가 없음
