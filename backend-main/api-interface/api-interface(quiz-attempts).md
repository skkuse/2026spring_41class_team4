# SudoCampus QuizAttempts API / DTO 명세 (공유용)

- 작성일: 2026-06-01
- 기준 코드:
  - `src/quiz-attempts/quiz-attempts.controller.ts`
  - `src/quiz-attempts/quiz-attempts.service.ts`
  - `src/quiz-attempts/dto/*.ts`
  - `src/quiz-attempts/entities/*.ts`
  - `src/quiz-attempts/enums/attempt-status.enum.ts`

이 문서는 현재 백엔드에 구현된 QuizAttempts(응시 시작/답안 제출/최종 제출/리뷰) API와 DTO를 FE 공유용으로 정리한 문서입니다.

## 1) 공통 규칙

- 모든 QuizAttempts API는 인증 필요 (`Authorization: Bearer <accessToken>`)
- 모든 path param ID는 UUID 형식만 허용
  - `quizId: uuid`
  - `attemptId: uuid`
- ValidationPipe 설정
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
- 소유권 규칙
  - 응시 시작: `quiz.user_id === currentUser.id` 이어야 함
  - 답안 제출/최종 제출/리뷰: `quiz_attempts.user_id === currentUser.id` 이어야 함

---

## 2) API 목록 (현재 구현)

1. `POST /quiz/:quizId/attempts`
2. `POST /attempts/:attemptId/answers`
3. `POST /attempts/:attemptId/submit`
4. `GET /attempts/:attemptId/review`

---

## 3) Enum 명세

```ts
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
export type QuizProblemType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'SHORT_ANSWER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
```

---

## 4) DTO 명세

### SubmitAnswerDto

```ts
interface SubmitAnswerDto {
  quizProblemId: string; // UUID v4, required
  userAnswer?: string; // optional (SINGLE_CHOICE, SHORT_ANSWER에서 사용)
  selectedChoiceIds?: string[]; // optional (MULTIPLE_CHOICE에서 사용), UUID v4 array, non-empty
  usedHint: boolean; // required
  hintLevelUsed?: number | null; // optional, min 1
  elapsedSeconds?: number | null; // optional, min 0
}
```

검증 규칙:
- `quizProblemId`: `@IsUUID('4')`
- `userAnswer`: `@IsOptional @IsString`
- `selectedChoiceIds`: `@IsOptional @IsArray @ArrayNotEmpty @IsUUID('4', { each: true })`
- `usedHint`: `@IsBoolean`
- `hintLevelUsed`: `@IsOptional @IsInt @Min(1)`
- `elapsedSeconds`: `@IsOptional @IsInt @Min(0)`

### QuizAttemptStartResponseDto

```ts
interface QuizAttemptStartResponseDto {
  attemptId: string;
  quizId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
}
```

### SubmitAnswerResponseDto

```ts
interface UpdatedMasteryItemDto {
  keywordId: string;
  masteryScore: number;
}

interface SubmitAnswerResponseDto {
  quizProblemId: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  updatedMastery: UpdatedMasteryItemDto[];
  selectedChoiceIds?: string[]; // MULTIPLE_CHOICE일 때 포함
}
```

### SubmitAttemptResponseDto

```ts
interface SubmitAttemptResponseDto {
  attemptId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  totalQuizProblems: number;
  correctCount: number;
  score: number; // 0~100, 소수점 2자리
}
```

### AttemptReviewResponseDto

```ts
interface AttemptReviewChoiceDto {
  id: string;
  choiceText: string;
  displayOrder: number;
  isCorrect: boolean;
}

interface AttemptReviewKeywordDto {
  keywordId: string;
  name: string;
  weight: number | null;
}

interface AttemptReviewProblemDto {
  quizProblemId: string;
  displayOrder: number;
  problemText: string;
  quizProblemType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  userAnswer: string | null;
  selectedChoiceIds?: string[]; // MULTIPLE_CHOICE일 때 제공
  isUnanswered: boolean; // 미응답 여부
  isCorrect: boolean; // 미응답이면 false
  correctAnswer: string;
  explanation: string | null;
  feedback: string | null; // 미응답이면 null
  choices: AttemptReviewChoiceDto[]; // review에서는 정답 여부 포함
  keywords: AttemptReviewKeywordDto[];
}

interface AttemptReviewResponseDto {
  attemptId: string;
  quizId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  startedAt: string; // ISO datetime
  submittedAt: string | null; // ISO datetime
  totalQuizProblems: number;
  correctCount: number;
  score: number;
  feedback: string | null;
  problems: AttemptReviewProblemDto[];
}
```

---

## 5) API 상세

### 5.1 POST `/quiz/:quizId/attempts`

퀴즈 응시 시작.

- Path param
  - `quizId: uuid`
- Body 없음

Response:

```json
{
  "attemptId": "4bd1b0b1-1da8-41f9-96fb-5bcf5d26f4a4",
  "quizId": "e66b6919-9fcf-4588-8bf1-1f0ef828f7b0",
  "status": "IN_PROGRESS"
}
```

---

### 5.2 POST `/attempts/:attemptId/answers`

문항 1개 제출(문항별 upsert).

- Path param
  - `attemptId: uuid`
- Body (`application/json`)

SINGLE_CHOICE 예시:

```json
{
  "quizProblemId": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
  "userAnswer": "842357cf-8b53-43e1-b26b-438198e915f9",
  "usedHint": false,
  "hintLevelUsed": null,
  "elapsedSeconds": 21
}
```

MULTIPLE_CHOICE 예시:

```json
{
  "quizProblemId": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
  "selectedChoiceIds": [
    "842357cf-8b53-43e1-b26b-438198e915f9",
    "6c3dbccf-0197-45b3-8c89-d6d8e0c3a77d"
  ],
  "usedHint": true,
  "hintLevelUsed": 2,
  "elapsedSeconds": 35
}
```

SHORT_ANSWER 예시:

```json
{
  "quizProblemId": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
  "userAnswer": "폭포수 모델",
  "usedHint": false,
  "elapsedSeconds": 12
}
```

Response 예시:

```json
{
  "quizProblemId": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
  "isCorrect": true,
  "explanation": "요구사항-설계-구현-테스트 순으로 단계적으로 진행한다.",
  "feedback": "Good job.",
  "updatedMastery": [
    {
      "keywordId": "77822867-a290-4243-8270-8f092db8a6e1",
      "masteryScore": 0.73
    }
  ],
  "selectedChoiceIds": [
    "842357cf-8b53-43e1-b26b-438198e915f9",
    "6c3dbccf-0197-45b3-8c89-d6d8e0c3a77d"
  ]
}
```

채점 규칙:
- `SINGLE_CHOICE`
  - `userAnswer` 필수
  - `userAnswer`는 해당 문제의 choice ID여야 함
  - 해당 choice의 `isCorrect === true`면 정답
- `MULTIPLE_CHOICE`
  - `selectedChoiceIds` 필수(non-empty)
  - 모든 choice ID가 해당 문제 소속이어야 함
  - 정답 choice 집합과 정확히 일치해야 정답(순서 무관)
  - 저장 시 `quiz_problem_attempts.user_answer`에 JSON 문자열로 저장
- `SHORT_ANSWER`
  - `userAnswer` 필수
  - normalize(공백 정리 + 소문자화) 후 `answerText`와 비교

---

### 5.3 POST `/attempts/:attemptId/submit`

응시 최종 제출(채점 확정).

- Path param
  - `attemptId: uuid`
- Body 없음

Response:

```json
{
  "attemptId": "4bd1b0b1-1da8-41f9-96fb-5bcf5d26f4a4",
  "status": "GRADED",
  "totalQuizProblems": 10,
  "correctCount": 7,
  "score": 70
}
```

점수 규칙:
- `totalQuizProblems`: `quiz_problems` 전체 문항 수 기준
- `correctCount`: 현재 attempt에서 `is_correct = true` 문항 수
- 미응답 문항은 오답으로 간주되어 점수에 반영됨

---

### 5.4 GET `/attempts/:attemptId/review`

응시 리뷰 조회.

- Path param
  - `attemptId: uuid`

Response 예시:

```json
{
  "attemptId": "4bd1b0b1-1da8-41f9-96fb-5bcf5d26f4a4",
  "quizId": "e66b6919-9fcf-4588-8bf1-1f0ef828f7b0",
  "status": "GRADED",
  "startedAt": "2026-06-01T10:00:00.000Z",
  "submittedAt": "2026-06-01T10:10:00.000Z",
  "totalQuizProblems": 10,
  "correctCount": 7,
  "score": 70,
  "feedback": null,
  "problems": [
    {
      "quizProblemId": "171f3415-d5cd-4f30-baf3-2abf5b70f83f",
      "displayOrder": 1,
      "problemText": "다음 중 폭포수 모델의 특징은?",
      "quizProblemType": "MULTIPLE_CHOICE",
      "difficulty": "EASY",
      "userAnswer": "[\"842357cf-8b53-43e1-b26b-438198e915f9\"]",
      "selectedChoiceIds": ["842357cf-8b53-43e1-b26b-438198e915f9"],
      "isUnanswered": false,
      "isCorrect": true,
      "correctAnswer": "2번, 4번",
      "explanation": "단계적 진행과 문서화가 핵심이다.",
      "feedback": "Good job.",
      "choices": [
        {
          "id": "842357cf-8b53-43e1-b26b-438198e915f9",
          "choiceText": "각 단계 완료 후 다음 단계로 진행",
          "displayOrder": 1,
          "isCorrect": true
        }
      ],
      "keywords": [
        {
          "keywordId": "77822867-a290-4243-8270-8f092db8a6e1",
          "name": "폭포수 모델",
          "weight": 1
        }
      ]
    }
  ]
}
```

미응답 처리:
- `quiz_problem_attempts` row가 없으면 미응답 처리
- `userAnswer: null`
- `isCorrect: false`
- `isUnanswered: true`
- `feedback: null`
- `MULTIPLE_CHOICE`면 `selectedChoiceIds: []`

중요:
- 리뷰 API는 정답 정보(`correctAnswer`, `choices[].isCorrect`)를 반환함
- 반대로 풀이 API(`GET /quiz/:quizId`)는 정답 정보를 반환하면 안 됨

---

## 6) 에러 코드 가이드

- `400`
  - path/body validation 실패
  - attempt가 이미 채점 완료(`GRADED`) 상태
  - `quizProblemId`가 attempt의 quiz 소속이 아님
  - 문제 유형별 답안 형식 불일치
- `401`: 인증 실패
- `403`: 소유권 없음 (타 사용자 quiz/attempt)
- `404`: quiz/attempt 없음
- `500`: 내부 데이터 무결성 오류

---

## 7) FE 연동 체크포인트

- `MULTIPLE_CHOICE` 답안 전송은 `selectedChoiceIds` 사용
- `SINGLE_CHOICE`는 기존처럼 `userAnswer=choiceId` 사용
- 리뷰 화면에서는 `isUnanswered`를 우선 사용해 미응답 표시
- `selectedChoiceIds`는 리뷰 렌더링용이며, 하위 호환을 위해 `userAnswer`도 함께 내려옴

---

## 8) 2026-06-05 정책 정정: MULTIPLE_CHOICE / 최종 제출 / Mastery

이 섹션이 위의 오래된 `non-empty` 문구보다 우선한다.

### MULTIPLE_CHOICE 제출

- `selectedChoiceIds` 필드는 반드시 포함해야 한다.
- `selectedChoiceIds: []`를 허용한다.
- `selectedChoiceIds`를 null 또는 omitted로 보내면 안 된다.
- 0개 정답 문항에서 사용자가 `[]`를 제출하면 정답 처리될 수 있다.
- 서버는 선택된 choice ID를 정렬하고 JSON 문자열로 저장한다.
- 빈 배열 제출은 `quiz_problem_attempts.user_answer = "[]"`로 저장된다.
- 채점은 정렬된 selected choice ID 목록과 정렬된 correct choice ID 목록을 비교한다.

### 최종 제출

- `POST /attempts/:attemptId/submit` 시 미응답 문제는 오답으로 확정된다.
- 해당 attempt에 `quiz_problem_attempts` row가 없는 문제는 `isCorrect = false` row로 생성된다.
- 기존 row가 있지만 `isCorrect = null`인 문제는 `isCorrect = false`로 업데이트된다.
- `totalQuizProblems`, `correctCount`, `score`는 미응답/null 문제를 오답 확정한 뒤 재계산된다.
- 진행 중인 attempt에서는 `isCorrect = null`을 오답으로 간주하지 않는다.

### Mastery 갱신

- `POST /attempts/:attemptId/answers`는 개별 답안 저장 후 `updatedMastery`를 반환한다.
- `POST /attempts/:attemptId/submit`은 미응답/null 문제를 오답 확정한 뒤 mastery를 재계산한다.
- 최종 제출 응답 shape는 기존 호환성을 위해 `updatedMastery`를 포함하지 않는다.
- Mastery 계산은 `isCorrect IS NOT NULL`인 persisted attempts만 사용한다.
