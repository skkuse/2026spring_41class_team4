# Frontend API Interface (Current + Planned)

Last updated: 2026-05-25  
Source references:

- `src/*` (implemented endpoints)
- `document/01-requirements-summary.md`
- `document/02-database-spec.md`
- `document/03-implementation-spec.md`
- `document/04-system-architecture-backend.updated.md`
- `document/05-implementation-backlog.md`

This document is for frontend-backend collaboration.  
It separates:

- `LIVE`: available in current backend code
- `LIVE_MINIMAL`: currently available, but response is smaller than the target design
- `TARGET_WITH_SOURCE_REFS`: target keyword response including sourceRefs from document chunks
- `PLANNED`: required by design docs, not fully implemented yet

## 1) Common Rules

### Base

- Base URL: `http://localhost:3000`
- Content type: `application/json` (except file upload: `multipart/form-data`)
- Auth header for protected APIs: `Authorization: Bearer <accessToken>`

### Validation and errors

- Global validation is enabled (`whitelist: true`, `forbidNonWhitelisted: true`)
- Typical status codes:
  - `400` invalid request body/params
  - `401` missing or invalid token
  - `403` resource ownership denied
  - `404` resource not found
  - `500` internal error
  - `503` AI provider unavailable/quota issue

### Shared enums

```ts
export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

// target status in design docs (future migration target)
export type DocumentAnalysisStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'ANALYZED'
  | 'FAILED';
```

## 2) Endpoint Map

| Domain    | Endpoint                                      | Status  | Note                                                 |
| --------- | --------------------------------------------- | ------- | ---------------------------------------------------- |
| Auth      | `POST /auth/register/verification-code`       | LIVE    | request signup verification code                     |
| Auth      | `POST /auth/register`                         | LIVE    | native signup with verification code (no auto-login) |
| Auth      | `POST /auth/login`                            | LIVE    | native login                                         |
| Auth      | `POST /auth/find-id`                          | LIVE    | find email ID by email and name                      |
| Auth      | `POST /auth/password-reset/verification-code` | LIVE    | request password reset verification code             |
| Auth      | `POST /auth/password-reset/confirm`           | LIVE    | reset password with verification code                |
| Auth      | `POST /auth/google`                           | LIVE    | Google login                                         |
| Auth      | `POST /auth/refresh`                          | LIVE    | refresh token rotation                               |
| Auth      | `POST /auth/logout`                           | LIVE    | invalidate all sessions                              |
| Auth      | `GET /auth/me`                                | LIVE    | current user                                         |
| Users     | `GET /users/me`                               | LIVE    | profile                                              |
| Users     | `PATCH /users/me`                             | LIVE    | update name only                                     |
| Documents | `POST /subjects/:subjectId/documents/upload`  | LIVE    | upload PDF to owned subject                          |
| Subjects  | `GET /subjects`                               | PLANNED | list subjects                                        |
| Subjects  | `POST /subjects`                              | PLANNED | create subject                                       |
| Subjects  | `GET /subjects/:subjectId`                    | PLANNED | subject detail                                       |
| Subjects  | `DELETE /subjects/:subjectId`                 | PLANNED | subject delete                                       |
| Documents | `POST /subjects/:subjectId/documents/upload`  | LIVE    | subject-bound upload API                             |
| Documents | `POST /documents/:documentId/analyze`         | PLANNED | analysis pipeline target API                         |
| Documents | `POST /documents/upload-and-generate`         | PLANNED | upload + async generation                            |
| Documents | `POST /documents/:documentId/generate`        | PLANNED | batch generate summary/quiz                          |
| Documents | `GET /documents/:documentId/status`           | PLANNED | generation status                                    |
| Documents | `GET /documents/:documentId`                  | PLANNED | detail view                                          |
| Keywords  | `GET /subjects/:subjectId/keywords`           | LIVE_MINIMAL / TARGET_WITH_SOURCE_REFS | subject keywords aggregated from documents |
| Keywords  | `GET /documents/:documentId/keywords`         | LIVE_MINIMAL / TARGET_WITH_SOURCE_REFS | document keywords with target sourceRefs |
| Quiz      | `POST /documents/:documentId/quiz`            | PLANNED | lecture quiz generation                              |
| Quiz      | `GET /quiz/:quizId`                           | PLANNED | quiz view                                            |
| Attempt   | `POST /quiz/:quizId/attempts`                 | LIVE | start attempt                                        |
| Attempt   | `POST /attempts/:attemptId/answers`           | LIVE | submit one answer and update mastery                 |
| Attempt   | `POST /attempts/:attemptId/submit`            | LIVE | finalize attempt; unanswered problems become incorrect |
| Attempt   | `GET /attempts/:attemptId/review`             | LIVE | review                                               |
| Mastery   | `GET /subjects/:subjectId/mastery`            | LIVE | subject mastery stats derived from document keywords |
| Dashboard | `GET /subjects/:subjectId/dashboard`          | PLANNED | subject dashboard                                    |
| Mock Exam | `POST /subjects/:subjectId/mock-exams`        | LIVE | personalized mock exam                               |
| Mock Exam | `GET /subjects/:subjectId/mock-exams`         | LIVE | list mock exams with latest attempt summary          |

## 3) TypeScript Interfaces for Frontend

```ts
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RequestRegisterVerificationCodeRequest {
  email: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  verificationCode: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface FindIdRequest {
  email: string;
  name: string;
}

export interface FindIdResponse {
  found: boolean;
  email: string | null;
}

export interface RequestPasswordResetVerificationCodeRequest {
  email: string;
  name: string;
}

export interface ConfirmPasswordResetRequest {
  email: string;
  name: string;
  verificationCode: string;
  newPassword: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface UserMe extends AuthUser {
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface UploadParseResult {
  documentId: string;
  fileUrl: string;
  pageCount: number;
  analysisStatus: DocumentAnalysisStatus;
  canAnalyze: boolean;
}

export interface SubjectItem {
  id: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  masteryScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordSourceRef {
  chunkId: string;
  pageNumber: number;
  heading?: string | null;
  evidenceText?: string | null;
  relevanceScore?: number | null;
}

export interface DocumentChunkItem {
  id: string;
  documentId: string;
  pageNumber: number;
  heading?: string | null;
  content: string;
  visualNote?: string | null;
  displayOrder: number;
}

export interface KeywordItem {
  id: string;
  documentId: string;
  subjectId?: string;
  name: string;
  description?: string | null;
  importanceScore?: number | null;
  masteryScore?: number | null;
  sourceRefs?: KeywordSourceRef[];
}

export type QuizType = 'LECTURE' | 'MOCK_EXAM';
export type QuizProblemType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'SHORT_ANSWER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export type BloomLevel =
  | 'REMEMBER'
  | 'UNDERSTAND'
  | 'APPLY'
  | 'ANALYZE'
  | 'EVALUATE';

export type DokLevel = 1 | 2 | 3;

export type QuizQuestionTypeForDifficulty =
  | 'FACT_RECALL'
  | 'CONCEPT_EXPLANATION'
  | 'APPLICATION'
  | 'CONCEPT_COMPARE'
  | 'MULTI_STEP_REASONING';

export interface DifficultyFeatures {
  conceptCount: number;
  reasoningSteps: number;
  requiresInference: boolean;
  answerExplicitInMaterial: boolean;
  hasDistractors: boolean;
  requiresComparison: boolean;
  requiresApplication: boolean;
  questionType: QuizQuestionTypeForDifficulty;
}

export interface QuizProblemAssessmentMetadata {
  bloomLevel: BloomLevel;
  dokLevel: DokLevel;
  difficultyFeatures: DifficultyFeatures;
  modelPredictedDifficulty: DifficultyLevel;
  difficultyConfidence?: number | null;
  difficultyRationale?: string | null;
  evidenceChunkIds: string[];
}


export interface QuizChoice {
  id: string;
  choiceText: string;
  displayOrder: number;
}

export interface QuizProblemForSolve {
  id: string;
  problemText: string;
  quizProblemType: QuizProblemType;
  difficulty: DifficultyLevel;
  displayOrder: number;
  choices?: QuizChoice[];
  hintLevel1?: string | null;
  hintLevel2?: string | null;
  hintLevel3?: string | null;
}

export interface QuizForSolve {
  id: string;
  title: string;
  quizType: QuizType;
  quizProblems: QuizProblemForSolve[];
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface QuizAttemptStartResponse {
  attemptId: string;
  quizId: string;
  status: AttemptStatus;
}

export interface SubmitAnswerRequest {
  quizProblemId: string;
  userAnswer?: string;
  selectedChoiceIds?: string[];
  usedHint: boolean;
  hintLevelUsed?: number | null;
  elapsedSeconds?: number | null;
}

export interface UpdatedMasteryItem {
  keywordId: string;
  masteryScore: number;
}

export interface SubmitAnswerResponse {
  quizProblemId: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  updatedMastery: UpdatedMasteryItem[];
  selectedChoiceIds?: string[];
}

export interface SubjectMasteryKeyword {
  keywordId: string;
  name: string;
  masteryScore: number;
}

export interface SubjectMasteryResponse {
  subjectId: string;
  overallMastery: number;
  strongKeywords: SubjectMasteryKeyword[];
  weakKeywords: SubjectMasteryKeyword[];
}

export interface CreateMockExamRequest {
  quizProblemCount: number;
  documentIds?: string[];
  targetWeakKeywords?: boolean;
  keywordIds?: string[];
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
  startedAt: string;
  submittedAt: string | null;
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
  createdAt: string;
  latestAttempt: MockExamLatestAttempt | null;
}
```

## 4) LIVE Contract Details

## 4.1 Auth

### POST `/auth/register/verification-code`

Request:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "success": true
}
```

### POST `/auth/register`

Request:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "password123!",
  "verificationCode": "123456"
}
```

Response:

```json
{
  "success": true
}
```

Notes:

- Duplicate email returns `409 Conflict`.
- Invalid or expired verification code returns `400 Bad Request`.
- Too many failed verification attempts returns `429 Too Many Requests`.
- This endpoint does not issue tokens and does not auto-login.
- Frontend should call `POST /auth/login` after successful signup.

### POST `/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "password123!"
}
```

Response: `AuthTokenPair`

### POST `/auth/find-id`

Request:

```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

Response:

```json
{
  "found": true,
  "email": "u***@example.com"
}
```

or

```json
{
  "found": false,
  "email": null
}
```

### POST `/auth/password-reset/verification-code`

Request:

```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

Response:

```json
{
  "success": true
}
```

### POST `/auth/password-reset/confirm`

Request:

```json
{
  "email": "user@example.com",
  "name": "User Name",
  "verificationCode": "123456",
  "newPassword": "newPassword123!"
}
```

Response:

```json
{
  "success": true
}
```

### POST `/auth/google`

Request:

```json
{
  "idToken": "google-id-token"
}
```

Response: `AuthTokenPair`

### POST `/auth/refresh`

Request:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

Response: `AuthTokenPair`

### POST `/auth/logout`

Response:

```json
{
  "success": true
}
```

### GET `/auth/me`

Response: `AuthUser`

## 4.2 Users

### GET `/users/me`

Response: `UserMe`

### PATCH `/users/me`

Request:

```json
{
  "name": "New Name"
}
```

Response: `UserMe`

## 4.3 Documents

### POST `/subjects/:subjectId/documents/upload`

- `multipart/form-data`
- field: `file` (PDF)
- optional field: `title`

Response: `UploadParseResult`

## 4.4 Keywords

### GET `/subjects/:subjectId/keywords`

Status:

- Current: `LIVE_MINIMAL`
- Target: `TARGET_WITH_SOURCE_REFS`

Returns keywords under the subject. Same-name keywords from different documents may be grouped by the frontend for display, but each item keeps its own keyword ID and document context.

Ownership:

- The subject must belong to the current user.

Current minimal response: `KeywordItem[]` without guaranteed `sourceRefs`.

Target response: `KeywordItem[]` with `sourceRefs` when keyword-source mappings are available.

### GET `/documents/:documentId/keywords`

Status:

- Current: `LIVE_MINIMAL`
- Target: `TARGET_WITH_SOURCE_REFS`

Returns keywords that belong to the document.

Ownership:

- The document must belong to the current user.

Current minimal response: `KeywordItem[]` without guaranteed `sourceRefs`.

Target response: `KeywordItem[]` including `sourceRefs` that point to cleaned document chunks used as evidence.

## 5) PLANNED Contract Details (Design Target)

These are not fully implemented yet, but frontend should design with these interfaces.

## 5.1 Subjects

### GET `/subjects`

Response:

```json
[
  {
    "id": "uuid",
    "name": "Computer Networks",
    "description": "optional",
    "thumbnailUrl": "https://...",
    "createdAt": "2026-05-25T00:00:00.000Z",
    "updatedAt": "2026-05-25T00:00:00.000Z"
  }
]
```

### POST `/subjects`

Request:

```json
{
  "name": "Computer Networks",
  "description": "optional",
  "thumbnailUrl": "https://..."
}
```

Response: `SubjectItem`

## 5.2 Documents (target shape)

### POST `/documents/:documentId/analyze`

Response:

```json
{
  "documentId": "uuid",
  "analysisStatus": "ANALYZED",
  "pageCount": 42,
  "keywordCount": 18,
  "chunkCount": 42
}
```

### GET `/documents/:documentId`

Response should include:

- document metadata
- analysis status
- overall summary
- keywords with sourceRefs
- optional document chunk metadata

## 5.3 Quiz / Attempt / Mastery / Dashboard / Mock

### GET `/documents/:documentId/keywords` target response example

```json
[
  {
    "id": "keyword-uuid",
    "documentId": "document-uuid",
    "name": "Software Engineering",
    "description": "Professional software development using theories, methods, and tools.",
    "importanceScore": 0.95,
    "masteryScore": 0.32,
    "sourceRefs": [
      {
        "chunkId": "chunk-uuid",
        "pageNumber": 6,
        "heading": "Software Engineering",
        "evidenceText": "Software engineering is concerned with theories, methods and tools for professional software development.",
        "relevanceScore": 0.95
      }
    ]
  }
]
```

### POST `/documents/:documentId/quiz`

Request:

```json
{
  "quizProblemCount": 10,
  "keywordIds": ["keyword-uuid-1", "keyword-uuid-2"],
  "difficulty": "MEDIUM"
}

Note:

- Backend should use selected `keywordIds` to load related chunks through `keyword_chunks -> document_chunks`.
- Frontend sends keyword IDs only; frontend does not send raw lecture markdown.
- Quiz generation output must not expose answers in solving view.
```

Response:

```json
{
  "quizId": "uuid",
  "quizType": "LECTURE",
  "quizProblemCount": 10
}
```

### Quiz Difficulty Control Note

The `difficulty` stored and returned by the backend is the backend-calculated final difficulty.

The quiz generation AI may return `modelPredictedDifficulty`, but this value is not trusted as the final difficulty. The backend calculates final difficulty from structured `difficultyFeatures` based on Bloom's Taxonomy, Webb's DOK, Evidence-Centered Design, and Automatic Item Generation principles.

For MVP, `QuizProblemForSolve` exposes only the final `difficulty`. Assessment metadata such as `bloomLevel`, `dokLevel`, `difficultyFeatures`, `modelPredictedDifficulty`, `difficultyConfidence`, `difficultyRationale`, and `evidenceChunkIds` may be used internally during generation and validation. These fields should not be required in the solving API unless a future review or admin/debug API needs them.

### GET `/quiz/:quizId`

Response: `QuizForSolve`

### POST `/quiz/:quizId/attempts`

Response: `QuizAttemptStartResponse`

### POST `/attempts/:attemptId/answers`

Request: `SubmitAnswerRequest`  
Response: `SubmitAnswerResponse`

Notes:

- `SINGLE_CHOICE`: send exactly one selected choice ID through `userAnswer`.
- `MULTIPLE_CHOICE`: send `selectedChoiceIds`; an empty array is allowed for zero-correct-choice problems, but the field must not be omitted.
- `MULTIPLE_CHOICE` answers are stored as sorted JSON strings and graded by comparing sorted selected choice IDs with sorted correct choice IDs.
- `SHORT_ANSWER`: send text through `userAnswer`.
- `updatedMastery` contains recalculated scores for keywords connected through `quiz_problem_keywords`.

### POST `/attempts/:attemptId/submit`

Response:

```json
{
  "attemptId": "uuid",
  "status": "GRADED",
  "totalQuizProblems": 10,
  "correctCount": 8,
  "score": 80.0
}
```

Notes:

- Final submit creates incorrect attempts for unanswered quiz problems.
- Existing problem attempts with `is_correct = null` are converted to `is_correct = false`.
- Attempt totals and score are recalculated after unanswered/null attempts are finalized.
- Mastery is recalculated after finalization, but this response shape remains unchanged.

### GET `/attempts/:attemptId/review`

Response should include:

- attempt summary
- per-problem user answer
- correctness
- correct answer
- explanation
- feedback
- related keywords

### GET `/subjects/:subjectId/mastery`

Response: `SubjectMasteryResponse`

Status: `LIVE`

Derivation:

- Validates subject ownership for the current user.
- Loads documents under the subject.
- Loads document-scoped keywords under those documents.
- Left joins `mastery_scores` by current `user_id + keyword_id`.
- Does not store or require `subject_id` in `mastery_scores`.

Response example:

```json
{
  "subjectId": "subject-uuid",
  "overallMastery": 0.55,
  "strongKeywords": [
    {
      "keywordId": "keyword-uuid-1",
      "name": "Software Engineering",
      "masteryScore": 0.8
    }
  ],
  "weakKeywords": [
    {
      "keywordId": "keyword-uuid-2",
      "name": "Waterfall Model",
      "masteryScore": 0.3
    }
  ]
}
```

Rules:

- `overallMastery` is the average `masteryScore` of attempted keywords.
- `strongKeywords`: `masteryScore >= 0.7`.
- `weakKeywords`: `masteryScore < 0.4`.
- Unattempted keywords are excluded from `strongKeywords` and `weakKeywords` for MVP.
- If there are no attempted keywords, `overallMastery` is `0` and both arrays are empty.

### GET `/subjects/:subjectId/dashboard`

Response should include:

- overall mastery
- coverage
- strong keywords
- weak keywords
- recent attempts
- document summaries

### POST `/subjects/:subjectId/mock-exams`

Request:

```json
{
  "quizProblemCount": 5,
  "documentIds": ["document-uuid"],
  "targetWeakKeywords": true,
  "keywordIds": []
}
```

Status: `LIVE`

Response:

```json
{
  "mockExamId": "uuid",
  "quizId": "uuid",
  "quizType": "MOCK_EXAM",
  "quizProblemCount": 5
}
```

Rules:

- Requires JWT authentication.
- Validates subject ownership.
- If `documentIds` are provided, every document must belong to the subject and current user.
- If `documentIds` are provided, every selected document must be `ANALYZED`.
- If `keywordIds` are provided, those keywords are selected first and must belong to the selected document scope.
- If `keywordIds` are empty and `targetWeakKeywords` is true, selects weak keywords where `masteryScore < 0.4`.
- Fallback order is: explicit `keywordIds` -> weak keywords -> no-mastery keywords -> remaining keywords by `importanceScore DESC`.
- Source chunks are loaded through `keyword_chunks -> document_chunks`.
- Generated quiz is saved with `quizType = "MOCK_EXAM"` and `documentId = null`.
- The server saves `quiz`, `quiz_problems`, `quiz_problem_choices`, `quiz_problem_keywords`, `mock_exams`, and `mock_exam_problems` in one transaction.
- The existing quiz solving and attempt APIs are reused.

### GET `/subjects/:subjectId/mock-exams`

Status: `LIVE`

Response:

```json
[
  {
    "mockExamId": "uuid",
    "quizId": "uuid",
    "subjectId": "uuid",
    "title": "Computer Networks Mock Exam",
    "quizProblemCount": 5,
    "targetWeakKeywords": true,
    "generatedFromMastery": true,
    "createdAt": "2026-06-05T05:12:30.000Z",
    "latestAttempt": {
      "attemptId": "uuid",
      "status": "GRADED",
      "startedAt": "2026-06-05T05:15:00.000Z",
      "submittedAt": "2026-06-05T05:25:00.000Z",
      "totalQuizProblems": 5,
      "correctCount": 4,
      "score": 80
    }
  }
]
```

Rules:

- Requires JWT authentication.
- Validates subject ownership.
- Joins `mock_exams` with `quiz`.
- Returns only rows where `quiz.quiz_type = MOCK_EXAM`.
- Filters both `mock_exams` and `quiz` by current `userId` and `subjectId`.
- Sorts by `mock_exams.created_at DESC`.
- Includes the current user's latest quiz attempt summary as `latestAttempt`.
- If the mock exam has never been attempted, `latestAttempt` is `null`.
- Use `quizId` for `GET /quiz/:quizId`.
- Use `latestAttempt.attemptId` for `GET /attempts/:attemptId/review` when detailed result data is needed.

## 6) Frontend Collaboration Notes

### Immediate integration (now)

- Use `POST /auth/register` first, then call `POST /auth/login` separately for token issuance.
- Use Google login when CORS/HTTPS configuration is resolved.
- For document flow, UI should poll `GET /documents/:documentId/status`.

### Forward compatibility

- Build API client by domain (`auth`, `users`, `documents`, `subjects`, `quiz`, `attempt`, `mastery`, `dashboard`, `mockExam`).
- Keep auth API client methods separated: `register`, `login`, `loginWithGoogle`, `refresh`, `logout`, `me`.
- `AuthTokenPair` is returned only by `POST /auth/login`, `POST /auth/google`, and `POST /auth/refresh`.
- Keep document status mapper both for current lowercase status and target uppercase status.
- Keep quiz/attempt page components reusable so they can connect to planned endpoints with minimal UI changes.

### Transition warning

- Current upload route is `/subjects/:subjectId/documents/upload`.
- Frontend should isolate route paths in one API config layer for easy switch.
- Internal parser artifacts (json/markdown/image path arrays) are not API contract.
