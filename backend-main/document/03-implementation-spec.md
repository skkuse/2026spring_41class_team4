# SudoCampus Implementation Specification

> 紐⑹쟻: ??臾몄꽌??SudoCampus??湲곕뒫 援ы쁽 湲곗????뺤쓽?쒕떎.  
> ?ъ슜 ??? ? 媛쒕컻?? LLM 湲곕컲 肄붾뵫 ?꾧뎄, Codex, NestJS 援ы쁽??  
> Database 湲곗? 臾몄꽌: `02-database-spec.md`
> Terminology: 蹂??꾨줈?앺듃?먯꽌???댁쫰 ?덉쓽 媛쒕퀎 臾몄젣瑜?`Question`???꾨땲??`QuizProblem`?쇰줈 遺瑜몃떎.

---

## 1. System Scope

SudoCampus MVP supports the following core user flow:

```text
Google Login or Native Login
??Create Subject
??Upload PDF
??Analyze PDF
??Extract Keywords
??Generate Lecture Quiz
??Submit Answers
??Update Mastery
??View Dashboard
??Generate Mock Exam
```

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | TypeORM |
| Authentication | Google OAuth + Native Email/Password + Verification Code + JWT (Access/Refresh) |
| AI API | OpenAI API |
| PDF Processing | PDF parsing library |
| API Style | REST API |
| Data Format | JSON |
| File Upload | multipart/form-data |

---

## 3. Backend Module List

Implement backend modules in this structure.

| Module | Responsibility |
|---|---|
| `AuthModule` | Google OAuth login, native register/login, verification code flow, find ID, password reset, token issuing, current user lookup |
| `UserModule` | User profile lookup and management |
| `SubjectModule` | Subject create/read/update/delete |
| `DocumentModule` | PDF upload, document metadata, PDF analysis pipeline |
| `KeywordModule` | keyword storage, keyword lookup, quiz problem-keyword mapping |
| `QuizModule` | Lecture quiz generation, quiz problem and choice storage |
| `QuizAttemptModule` | Quiz attempt creation, answer submission, grading |
| `MasteryModule` | Mastery score calculation and update |
| `MockExamModule` | Personalized mock exam generation |
| `DashboardModule` | Subject/document-level learning status, strong/weak keywords, coverage |
| `AiModule` | OpenAI API integration |
| `PdfModule` | PDF parsing abstraction |

---

## 4. Common Implementation Rules

### 4.1 Authentication Rule

All protected API endpoints must require authenticated user.

Every request to user-owned resources must verify ownership.

Example:

```text
A user can access a subject only if subjects.user_id = currentUser.id.
```

---

### 4.2 Database Rule

Use the schema defined in `02-database-spec.md`.

Rules:

1. Do not invent new tables unless explicitly requested.
2. Use UUID primary keys.
3. Use TypeORM relations for foreign keys.
4. Use DTO validation for API inputs.
5. Use service layer for business logic.
6. Controllers should not contain complex logic.
7. All user-owned queries must filter by `user_id`.

---

### 4.3 Error Response Rule

Recommended error responses:

| Situation | HTTP Status |
|---|---:|
| Missing or invalid token | 401 |
| Accessing another user's resource | 403 |
| Resource not found | 404 |
| Invalid input | 400 |
| PDF analysis failed | 422 or 500 |
| AI generation failed | 502 or 500 |

---

### 4.4 Environment Variables (Auth)

| Key | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_ISSUER` | Yes | JWT issuer (`iss`) |
| `JWT_AUDIENCE` | Yes | JWT audience (`aud`) |
| `JWT_ACCESS_EXPIRES_IN` | Yes | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Yes | Refresh token TTL (e.g. `30d`) |
| `AUTH_ALLOWED_EMAIL_DOMAIN` | No | Optional Google email domain restriction |
| `GOOGLE_CLIENT_ID` | Yes | Google ID token audience/client ID |
| `BCRYPT_SALT_ROUNDS` | No | bcrypt cost factor for native password hash, default 10 or 12 |
| `AUTH_VERIFICATION_CODE_LENGTH` | No | Verification code length, default 6 |
| `AUTH_VERIFICATION_CODE_TTL_MINUTES` | No | Verification code expiration time, default 5 or 10 minutes |
| `MAIL_HOST` | Required for email delivery | SMTP host |
| `MAIL_PORT` | Required for email delivery | SMTP port |
| `MAIL_USER` | Required for email delivery | SMTP username |
| `MAIL_PASSWORD` | Required for email delivery | SMTP password |
| `MAIL_FROM` | Required for email delivery | Sender email address |

---

## 5. API Contract Draft

## 5.1 Auth APIs

### POST `/auth/register/verification-code`

Purpose: Send a verification code for native signup.

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

Process:

1. Validate email format.
2. Check whether the email is already registered.
3. If already registered, return `409 Conflict`.
4. Generate a numeric verification code.
5. Store only `code_hash` in `auth_verification_codes` with `purpose = SIGNUP_VERIFICATION`.
6. Send the raw code through email.

Tables used:

- `users`
- `auth_verification_codes`

---

### POST `/auth/register`

Purpose: Complete native email/password signup after verification code validation.

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

Process:

1. Validate name, email, password, and verification code.
2. Check duplicate email in `users`.
3. Verify an unexpired and unused signup code from `auth_verification_codes`.
4. Create `users` with role `USER`, status `ACTIVE`, token version `0`, and `email_verified_at`.
5. Hash password using bcrypt.
6. Create `password_credentials` for the user.
7. Mark the verification code as consumed.
8. Return only `{ "success": true }` (no auto-login).

Tables used:

- `users`
- `password_credentials`
- `auth_verification_codes`

Frontend note:

- After successful register, call `POST /auth/login` separately to receive `AuthTokenPair`.

---

### POST `/auth/login`

Purpose: Native email/password login.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123!"
}
```

Response: `AuthTokenPair`.

Process:

1. Find user by email.
2. If user does not exist, return `401 Unauthorized`.
3. Find `password_credentials` by user ID.
4. If password credential does not exist, return `401 Unauthorized`.
5. Compare request password with `password_hash` using bcrypt.
6. If password is invalid, return `401 Unauthorized`.
7. Check `users.status = ACTIVE`.
8. Check native account email verification state if policy requires it.
9. Return access token + refresh token and user profile.

Tables used:

- `users`
- `password_credentials`

---

### POST `/auth/find-id`

Purpose: Find or confirm the user's login ID. In SudoCampus, the login ID is the email address.

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

If no matching user is found:

```json
{
  "found": false,
  "email": null
}
```

Tables used:

- `users`

---

### POST `/auth/password-reset/verification-code`

Purpose: Send a verification code for password reset after email and name confirmation.

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

Security note:

- To reduce account enumeration risk, this endpoint may return `success: true` even when the email/name pair is not found.

Tables used:

- `users`
- `auth_verification_codes`

---

### POST `/auth/password-reset/confirm`

Purpose: Reset a native account password after verification code validation.

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

Process:

1. Validate email, name, verification code, and new password.
2. Find user by email and name.
3. Verify an unexpired and unused password reset code.
4. Hash the new password using bcrypt.
5. Update `password_credentials.password_hash`.
6. Increment `users.token_version` to invalidate existing refresh tokens.
7. Mark the verification code as consumed.

Tables used:

- `users`
- `password_credentials`
- `auth_verification_codes`

---

### POST `/auth/google`

Purpose: Google OAuth login.

Request:

```json
{
  "idToken": "google-id-token"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "profileImageUrl": "https://...",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

Process:

1. Verify Google ID token.
2. Extract provider user ID, email, name, profile image.
3. Find `oauth_accounts` by `(provider, provider_user_id)`.
4. If exists, load linked user.
5. If not exists, create `users` and `oauth_accounts`.
6. Return access token + refresh token and user profile.

Tables used:

- `users`
- `oauth_accounts`

---

### POST `/auth/refresh`

Purpose: Rotate refresh token and issue new access/refresh pair.

Request:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

Response: `AuthTokenPair`

---

### POST `/auth/logout`

Purpose: Invalidate all active sessions for the current user via token version increment.

Response:

```json
{
  "success": true
}
```

Tables used:

- `users`

---

### GET `/auth/me`

Purpose: Return current authenticated user.

Response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "profileImageUrl": "https://..."
}
```

Tables used:

- `users`

---

## 5.2 Subject APIs

### GET `/subjects`

Purpose: List current user's subjects.

Response:

```json
[
  {
    "id": "uuid",
    "name": "Computer Networks",
    "description": "Network lecture materials",
    "thumbnailUrl": "https://...",
    "createdAt": "2026-05-20T00:00:00Z"
  }
]
```

Tables used:

- `subjects`

---

### POST `/subjects`

Purpose: Create a subject.

Request:

```json
{
  "name": "Computer Networks",
  "description": "Network lecture materials",
  "thumbnailUrl": "https://..."
}
```

Response:

```json
{
  "id": "uuid",
  "name": "Computer Networks",
  "description": "Network lecture materials",
  "thumbnailUrl": "https://..."
}
```

Validation:

- `name` is required.
- `name` must be unique per user.

Tables used:

- `subjects`

---

### GET `/subjects/:subjectId`

Purpose: Get subject detail.

Ownership:

- `subjects.user_id` must match current user.

Tables used:

- `subjects`
- `documents`
- `keywords`
- `mastery_scores`

---

### DELETE `/subjects/:subjectId`

Purpose: Delete a subject.

Ownership:

- `subjects.user_id` must match current user.

Decision needed:

- Hard delete cascade or soft delete?

---

## 5.3 Document APIs

### POST `/subjects/:subjectId/documents/upload`

Purpose: Upload PDF to a subject.

Content-Type:

```text
multipart/form-data
```

Input:

- `file`: PDF file
- `title`: optional title

Preconditions:

- User must be authenticated.
- Subject must belong to user.
- File must be PDF.

Process:

1. Validate subject ownership.
2. Validate file type.
3. Save file to storage.
4. Create `documents` row.
5. Set `analysis_status = UPLOADED`.
6. Return document metadata.

Tables used:

- `subjects`
- `documents`

Response:

```json
{
  "documentId": "uuid",
  "subjectId": "uuid",
  "title": "Week 1 Lecture",
  "analysisStatus": "UPLOADED"
}
```

---

### POST `/documents/:documentId/analyze`

Purpose: Analyze uploaded PDF.

Preconditions:

- User owns document.
- Document file exists.
- Document status is `UPLOADED` or `FAILED`.

Process:

1. Validate document ownership.
2. Set `documents.analysis_status = PROCESSING`.
3. Extract cleaned markdown only from the PDF. The main analyze flow must not require image extraction, raw parser JSON generation, or full debug markdown generation.
4. Parse the cleaned markdown into page-level `document_chunks`.
5. Store `document_chunks` for the document.
6. Generate a document-level summary from cleaned chunks.
7. Store the summary in `documents.overall_summary`.
8. Extract keywords from `document_chunks`. Keyword extraction must return source references to supporting chunks.
9. Insert or upsert keywords in `keywords` using `document_id`.
10. Insert keyword-source mappings in `keyword_chunks`.
11. Set `documents.analysis_status = ANALYZED`.
12. Set `documents.analyzed_at`.

On failure:

1. Set `documents.analysis_status = FAILED`.
2. Save `analysis_error_message`.

Tables used:

- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`

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

---

### GET `/documents/:documentId`

Purpose: Get document detail.

Response should include:

- document metadata
- analysis status
- page count
- overall summary
- keywords with source references
- optional chunk summary metadata

Tables used:

- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`

---

### GET `/documents/:documentId/status`

Purpose: Get document analysis status.

Response:

```json
{
  "documentId": "uuid",
  "analysisStatus": "PROCESSING",
  "errorMessage": null
}
```

Tables used:

- `documents`

---

## 5.4 Keyword APIs

### GET `/subjects/:subjectId/keywords`

Purpose: Get all keywords under a subject. Same-name keywords from different documents remain separate in data and may be grouped for display.

Preconditions:

- User must be authenticated.
- `subjects.user_id` must match current user.
- The response is derived by joining `subjects -> documents -> keywords`.

Tables used:

- `subjects`
- `documents`
- `keywords`
- `keyword_chunks`
- `document_chunks`
- `mastery_scores`

---

### GET `/documents/:documentId/keywords`

Purpose: Get keywords extracted from a document. Each keyword response should include the chunk/page evidence used for grounding.

Preconditions:

- User must be authenticated.
- `documents.user_id` must match current user.

Tables used:

- `documents`
- `keywords`
- `keyword_chunks`
- `document_chunks`

Response item shape:

```json
{
  "id": "keyword-uuid",
  "documentId": "document-uuid",
  "name": "Software Engineering",
  "description": "...",
  "importanceScore": 0.95,
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
```

---

## 5.5 Quiz APIs

### Quiz Difficulty Control Strategy

SudoCampus does not trust the LLM's direct `EASY`, `MEDIUM`, or `HARD` label as the final quiz problem difficulty.

The LLM may receive a requested difficulty as a generation direction, but the final `quiz_problems.difficulty` value must be calculated by the backend from structured difficulty metadata.

This strategy is based on four assessment design concepts:

| Concept | Usage in SudoCampus |
|---|---|
| Bloom's Taxonomy | Controls the cognitive level of the problem. |
| Webb's Depth of Knowledge (DOK) | Controls the reasoning depth and cognitive complexity. |
| Evidence-Centered Design (ECD) | Ensures each problem produces evidence for a specific keyword mastery claim. |
| Automatic Item Generation (AIG) | Makes the LLM fill a structured item model instead of freely generating arbitrary problems. |

#### Bloom Level

The generated problem should include one of the following `bloomLevel` values:

| Bloom Level | Meaning | Typical Final Difficulty |
|---|---|---|
| `REMEMBER` | Recall facts, terms, definitions, or direct statements. | EASY |
| `UNDERSTAND` | Explain or interpret a concept. | EASY / MEDIUM |
| `APPLY` | Apply a concept to a simple situation. | MEDIUM |
| `ANALYZE` | Compare concepts, identify relationships, or analyze cause and effect. | MEDIUM / HARD |
| `EVALUATE` | Select or judge the best answer based on evidence and reasoning. | HARD |

`CREATE` is excluded from the MVP because open-ended creation tasks are outside the initial quiz scope.

#### DOK Level

The generated problem should include one of the following `dokLevel` values:

| DOK Level | Meaning | Typical Final Difficulty |
|---:|---|---|
| `1` | Recall, recognition, or direct retrieval from the material. | EASY |
| `2` | Basic reasoning, simple application, or relationship explanation. | MEDIUM |
| `3` | Strategic reasoning, comparison, inference, or multi-step thinking. | HARD |

DOK is determined by the actual reasoning required, not only by the verb used in the question.

#### Evidence-Centered Design Rule

Every generated quiz problem must be connected to a measurable mastery claim.

```text
Claim:
The user understands target keyword K.

Evidence:
The user correctly answers a quiz problem linked to keyword K.

Task:
Generate a quiz problem grounded in document chunks related to keyword K.
```

Therefore, every generated problem must include:

- one or more `targetKeywordIds`
- one or more `evidenceChunkIds`
- `bloomLevel`
- `dokLevel`
- `difficultyFeatures`
- `modelPredictedDifficulty`
- `difficultyConfidence`
- `difficultyRationale`

#### Automatic Item Generation Rule

The LLM should generate quiz problems by filling a structured item model. The backend should provide:

- target keyword IDs
- source document chunks
- requested quiz problem type
- desired Bloom/DOK direction when applicable
- distractor rules
- difficulty control rules

This reduces hallucination and makes generated problems easier to validate.

#### Difficulty Features

The LLM must return structured `difficultyFeatures` for each generated problem.

```ts
interface DifficultyFeatures {
  conceptCount: number;
  reasoningSteps: number;
  requiresInference: boolean;
  answerExplicitInMaterial: boolean;
  hasDistractors: boolean;
  requiresComparison: boolean;
  requiresApplication: boolean;
  questionType:
    | 'FACT_RECALL'
    | 'CONCEPT_EXPLANATION'
    | 'APPLICATION'
    | 'CONCEPT_COMPARE'
    | 'MULTI_STEP_REASONING';
}
```

The backend calculates the final difficulty from these features.

```text
LLM modelPredictedDifficulty = reference only
Backend calculated difficulty = final value stored in quiz_problems.difficulty
```

MVP implementation may store only the final `difficulty` in `quiz_problems`. The assessment metadata may be kept as internal AI response data or logs first. If later analysis is needed, the database can be extended with `bloom_level`, `dok_level`, `difficulty_features`, `model_predicted_difficulty`, `difficulty_confidence`, and `difficulty_rationale`.


### POST `/documents/:documentId/quiz`

Purpose: Generate lecture quiz from a PDF document.

Request:

```json
{
  "quizProblemCount": 10,
  "keywordIds": ["uuid-1", "uuid-2"],
  "difficulty": "MEDIUM"
}
```

Preconditions:

- Document belongs to current user.
- Document analysis status must be `ANALYZED`.
- Keywords must belong to the target document. Subject-level keyword APIs aggregate keywords through the subject's documents.

Process:

1. Validate document ownership.
2. Load document metadata, overall summary, and extracted keywords.
3. Load selected or relevant keywords.
4. Load keyword-related `document_chunks` through `keyword_chunks`.
5. Build the AI input from target keywords, user mastery, and only the related chunks.
6. Call AI to generate quiz_problems grounded in the provided chunks using the Bloom/DOK/ECD/AIG item model.
7. For each generated quiz_problem, validate assessment metadata and calculate final difficulty from `difficultyFeatures`.
8. Create `quiz` with `quiz_type = LECTURE`.
9. Insert generated `quiz_problems` with backend-calculated `difficulty`.
10. Insert `quiz_problem_choices` for choice quiz_problems.
11. Insert `quiz_problem_keywords`.
12. Return quiz ID and quiz_problems.

Tables used:

- `documents`
- `keywords`
- `keyword_chunks`
- `document_chunks`
- `quiz`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`

Response:

```json
{
  "quizId": "uuid",
  "quizType": "LECTURE",
  "quizProblemCount": 10
}
```

---

### GET `/quiz/:quizId`

Purpose: Get quiz quiz_problems for taking quiz.

Important:

- Do not expose `answer_text` directly while taking quiz.
- Do not expose `is_correct` in choices before submission.

Response:

```json
{
  "id": "uuid",
  "title": "Week 1 Quiz",
  "quizType": "LECTURE",
  "quiz_problems": [
    {
      "id": "uuid",
      "questionText": "What is TCP?",
      "questionType": "SINGLE_CHOICE",
      "difficulty": "EASY",
      "choices": [
        {
          "id": "uuid",
          "choiceText": "Transmission Control Protocol",
          "displayOrder": 1
        }
      ]
    }
  ]
}
```

Tables used:

- `quiz`
- `quiz_problems`
- `quiz_problem_choices`

---

## 5.6 Quiz Attempt APIs

### POST `/quiz/:quizId/attempts`

Purpose: Start quiz attempt.

Process:

1. Validate quiz access.
2. Create `quiz_attempts`.
3. Set status to `IN_PROGRESS`.
4. Return attempt ID.

Tables used:

- `quiz`
- `quiz_attempts`

Response:

```json
{
  "attemptId": "uuid",
  "quizId": "uuid",
  "status": "IN_PROGRESS"
}
```

---

### POST `/attempts/:attemptId/answers`

Purpose: Submit answer for one quiz problem.

Request:

```json
{
  "quizProblemId": "uuid",
  "userAnswer": "A",
  "usedHint": false,
  "hintLevelUsed": null,
  "elapsedSeconds": 42
}
```

Process:

1. Validate attempt ownership.
2. Load quiz problem and answer.
3. Evaluate answer.
4. Upsert or create `quiz_problem_attempts`.
5. Load related keywords from `quiz_problem_keywords`.
6. Update `mastery_scores`.
7. Return result.

Tables used:

- `quiz_attempts`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_attempts`
- `quiz_problem_keywords`
- `mastery_scores`

Response:

```json
{
  "quizProblemId": "uuid",
  "isCorrect": true,
  "explanation": "TCP is a reliable transport protocol.",
  "feedback": "Good job.",
  "updatedMastery": [
    {
      "keywordId": "uuid",
      "masteryScore": 0.72
    }
  ]
}
```

---

### POST `/attempts/:attemptId/submit`

Purpose: Submit entire quiz attempt.

Process:

1. Validate attempt ownership.
2. Count total quiz_problems.
3. Count correct quiz problem attempts.
4. Calculate score.
5. Update `quiz_attempts.status = GRADED`.
6. Set `submitted_at`.
7. Return review summary.

Tables used:

- `quiz_attempts`
- `quiz_problem_attempts`
- `quiz_problems`

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

---

### GET `/attempts/:attemptId/review`

Purpose: Get quiz review result.

Response should include:

- score
- each quiz problem
- user answer
- correct answer
- explanation
- feedback
- related keywords

Tables used:

- `quiz_attempts`
- `quiz_problem_attempts`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `keywords`

---

## 5.7 Mastery APIs

### GET `/subjects/:subjectId/mastery`

Purpose: Get mastery data for a subject.

Response:

```json
{
  "subjectId": "uuid",
  "overallMastery": 0.64,
  "strongKeywords": [
    {
      "keywordId": "uuid",
      "name": "TCP",
      "masteryScore": 0.88
    }
  ],
  "weakKeywords": [
    {
      "keywordId": "uuid",
      "name": "Congestion Control",
      "masteryScore": 0.32
    }
  ]
}
```

Tables used:

- `mastery_scores`
- `keywords`

---

## 5.8 Mock Exam APIs

### POST `/subjects/:subjectId/mock-exams`

Purpose: Generate personalized mock exam.

Request:

```json
{
  "quizProblemCount": 10,
  "targetWeakKeywords": true,
  "keywordIds": []
}
```

Process:

1. Validate subject ownership.
2. Load mastery scores for subject.
3. Identify weak keywords.
4. Load important keywords.
5. Select target keywords.
6. Generate or select quiz_problems.
7. Create `quiz` with `quiz_type = MOCK_EXAM`.
8. Create `mock_exams`.
9. Insert `quiz_problems`, `quiz_problem_choices`, `quiz_problem_keywords`.
10. Insert `mock_exam_problems` if needed.
11. Return quiz ID.

Tables used:

- `subjects`
- `keywords`
- `mastery_scores`
- `quiz`
- `mock_exams`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `mock_exam_problems`

Response:

```json
{
  "mockExamId": "uuid",
  "quizId": "uuid",
  "quizProblemCount": 10
}
```

---

## 5.9 Dashboard APIs

### GET `/subjects/:subjectId/dashboard`

Purpose: Get subject dashboard.

Response should include:

- overall mastery
- coverage
- strong keywords
- weak keywords
- document list
- recent quiz attempts
- recent mock exams

Tables used:

- `subjects`
- `documents`
- `keywords`
- `quiz`
- `quiz_attempts`
- `mastery_scores`
- `quiz_problem_keywords`

Coverage calculation draft:

```text
coverage =
  number_of_keywords_used_in_quiz_problems
  / number_of_keywords_in_subject
```

Strong keyword draft:

```text
mastery_score >= 0.7
```

Weak keyword draft:

```text
mastery_score < 0.4
```

---

## 6. Feature Flow Specifications

## 6.1 Feature Flow: Google Login

### Input

- Google ID token

### Preconditions

- Google token is valid.

### Process

1. Verify Google token.
2. Extract provider profile.
3. Search `oauth_accounts` by provider and provider user ID.
4. If found, load user.
5. If not found:
   1. Create `users`.
   2. Create `oauth_accounts`.
6. Generate access token + refresh token.
7. Return token pair and user profile.

### Tables Used

- `users`
- `oauth_accounts`

### Output

- access token
- refresh token
- user profile

---

## 6.2 Feature Flow: Native Register/Login

### Input

- name, email, password for register
- email, password for login

### Preconditions

- Register email must not already exist in `users`.
- Login email must exist and have a `password_credentials` row.

### Process: Register

1. Validate request DTO.
2. Check duplicate email.
3. Create `users`.
4. Hash password using bcrypt.
5. Create `password_credentials`.
6. Generate access token + refresh token.
7. Return token pair and user profile.

### Process: Login

1. Validate request DTO.
2. Load user by email.
3. Load password credential by user ID.
4. Compare password using bcrypt.
5. Check user status.
6. Generate access token + refresh token.
7. Return token pair and user profile.

### Tables Used

- `users`
- `password_credentials`

---

## 6.3 Feature Flow: Create Subject

### Input

- user ID
- subject name
- description
- thumbnail URL

### Preconditions

- User is authenticated.

### Process

1. Validate subject name.
2. Check duplicate subject name for current user.
3. Insert `subjects`.
4. Return created subject.

### Tables Used

- `subjects`

---

## 6.4 Feature Flow: PDF Upload and Analysis

### Input

- authenticated user ID
- subject ID
- PDF file

### Preconditions

- User must be authenticated.
- Subject must belong to user.
- File type must be PDF.

### Process

1. Save PDF file to storage.
2. Create a row in `documents`.
3. Set `analysis_status` to `UPLOADED`.
4. Extract cleaned markdown only from the PDF for AI input.
5. Parse cleaned markdown into page-level `document_chunks`.
6. Generate a document-level summary from chunks.
7. Store the summary in `documents.overall_summary`.
8. Extract chunk-grounded keywords from `document_chunks`.
9. Insert keywords in `keywords` using `document_id`.
10. Store keyword evidence mappings in `keyword_chunks`.
11. Set `documents.analysis_status` to `ANALYZED`.

### Tables Used

- `subjects`
- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`

### Output

- document ID
- analysis status
- page count
- keyword count

---

## 6.5 Feature Flow: Generate Lecture Quiz

### Input

- user ID
- document ID
- quiz problem count
- selected keyword IDs
- optional difficulty

### Preconditions

- Document belongs to user.
- Document status is `ANALYZED`.

### Process

1. Load document.
2. Load document metadata, overall summary, and extracted keywords.
3. Load selected or extracted keywords.
4. Load keyword-related document chunks through `keyword_chunks`.
5. Generate quiz quiz_problems with AI using target keywords, user mastery, related chunks, and the Bloom/DOK/ECD/AIG item model.
6. Calculate final quiz problem difficulty from returned `difficultyFeatures`; do not directly trust `modelPredictedDifficulty`.
7. Create `quiz`.
8. Create `quiz_problems` with backend-calculated `difficulty`.
9. Create `quiz_problem_choices`.
10. Create `quiz_problem_keywords`.
11. Return quiz ID.

### Tables Used

- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`
- `quiz`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`

---

## 6.6 Feature Flow: Submit Answer and Update Mastery

### Input

- user ID
- attempt ID
- quiz problem ID
- user answer
- used hint
- elapsed seconds

### Process

1. Load quiz attempt.
2. Validate attempt ownership.
3. Load quiz problem.
4. Compare user answer with correct answer.
5. Save answer result into `quiz_problem_attempts`.
6. Load related keywords from `quiz_problem_keywords`.
7. For each keyword, calculate:
   - `recent_correct_rate`
   - `difficulty_weighted_score`
   - `no_hint_bonus`
8. Update or create `mastery_scores`.
9. Return correctness, explanation, feedback, and updated mastery data.

### MVP Mastery Formula

```text
mastery_score =
  0.7 * recent_correct_rate
+ 0.2 * difficulty_weighted_score
+ 0.1 * no_hint_bonus
```

### Tables Used

- `quiz_attempts`
- `quiz_problems`
- `quiz_problem_attempts`
- `quiz_problem_keywords`
- `mastery_scores`

---

## 6.7 Feature Flow: Generate Mock Exam

### Input

- user ID
- subject ID
- quiz problem count
- target weak keywords flag
- optional keyword IDs

### Preconditions

- Subject belongs to user.

### Process

1. Load subject.
2. Load subject keywords.
3. Load mastery scores.
4. Identify weak keywords.
5. Build target keyword list.
6. Generate mock exam quiz_problems with AI.
7. Create `quiz` with `quiz_type = MOCK_EXAM`.
8. Create `mock_exams`.
9. Create quiz_problems and quiz_problem_choices.
10. Connect quiz_problems to keywords.
11. Return mock exam quiz ID.

### Tables Used

- `subjects`
- `keywords`
- `mastery_scores`
- `quiz`
- `mock_exams`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `mock_exam_problems`

---

## 7. Service Responsibility Guide

## 7.1 AuthService

Responsible for:

- Google token verification
- OAuth account lookup
- Native register/login
- Password hashing and verification
- User creation
- JWT/session creation
- Current user loading
- Native signup and login orchestration
- Signup verification code validation
- Find ID processing
- Password reset verification code validation
- Password credential creation and update

Must not:

- Manage subjects or documents

---

## 7.2 SubjectService

Responsible for:

- Creating subjects
- Listing current user's subjects
- Checking subject ownership
- Deleting or updating subject

Must not:

- Parse PDFs
- Generate quiz

---

## 7.3 DocumentService

Responsible for:

- PDF upload metadata
- Document ownership check
- Analysis status management
- Coordinating cleaned markdown extraction, document chunk storage, summary generation, keyword extraction, and keyword-source mapping

Can depend on:

- `PdfService`
- `AiService`
- `KeywordService`
- `DocumentChunkRepository`

---

## 7.3.1 DocumentChunk handling

The MVP stores cleaned lecture text in `document_chunks`.

Required internal methods may include:

```ts
extractCleanedMarkdownOnly(filePath: string): Promise<{ markdown: string; pageCount: number }>;
parseCleanedMarkdownToChunks(markdown: string): ParsedDocumentChunk[];
replaceDocumentChunks(documentId: string, chunks: ParsedDocumentChunk[]): Promise<DocumentChunk[]>;
```

The existing image extraction, raw parser JSON generation, and full debug markdown methods may remain in the codebase, but the main analyze flow should use the cleaned markdown path only.

---

## 7.4 KeywordService

Responsible for:

- Creating keywords
- Storing keyword source references in `keyword_chunks`
- Fetching keywords by subject/document with sourceRefs
- Validating that selected quiz keyword IDs belong to the target document

---

## 7.5 QuizService

Responsible for:

- Lecture quiz generation using target keywords and related document chunks
- QuizProblem creation
- Choice creation
- QuizProblem-keyword mapping
- Quiz lookup for taking

Can depend on:

- `AiService`
- `KeywordService`
- `DocumentService`
- `DocumentChunkRepository` or a DocumentChunkService

---

## 7.6 QuizAttemptService

Responsible for:

- Starting quiz attempt
- Submitting answer
- Grading answer
- Finalizing attempt
- Returning review data

Can depend on:

- `MasteryService`

---

## 7.7 MasteryService

Responsible for:

- Loading quiz problem keywords
- Calculating recent correct rate
- Calculating difficulty weighted score
- Calculating no hint bonus
- Updating `mastery_scores`
- Finding strong/weak keywords

---

## 7.8 MockExamService

Responsible for:

- Loading mastery data
- Selecting weak keywords
- Generating personalized mock exams
- Creating mock exam quiz records

Can depend on:

- `QuizService`
- `MasteryService`
- `AiService`

---

## 7.9 DashboardService

Responsible for:

- Subject dashboard data
- Overall mastery calculation
- Coverage calculation
- Strong/weak keyword lists
- Recent quiz attempt summaries

---

## 7.10 VerificationCodeService

Responsible for:

- Generating verification codes
- Hashing verification codes
- Storing verification code records
- Verifying unexpired and unused codes
- Marking codes as consumed
- Tracking failed attempts

---

## 7.11 MailService

Responsible for:

- Sending signup verification codes
- Sending password reset verification codes

MVP uses email delivery. SMS delivery is a future extension unless a phone number is collected.

---

## 8. Validation Rules

## 8.1 Auth

| Field | Rule |
|---|---|
| `name` | required for register, max 100 |
| `email` | required, valid email, max 255 |
| `password` | required, min 8 recommended, max 72 for bcrypt input policy |

Email verification and password reset are excluded from the current MVP.

---

## 8.0 Auth

| Field | Rule |
|---|---|
| `name` | required for signup/find/reset, max 100 |
| `email` | required, valid email |
| `password` | required for signup/login, minimum length recommended |
| `newPassword` | required for password reset, minimum length recommended |
| `verificationCode` | required for signup and password reset confirm |

---

## 8.1 Subject

| Field | Rule |
|---|---|
| `name` | required, max 100 |
| `description` | optional |
| `thumbnailUrl` | optional URL |

---

## 8.2 Document Upload

| Field | Rule |
|---|---|
| `file` | required |
| `file.mimetype` | must be `application/pdf` |
| `title` | optional, max 255 |
| `subjectId` | must belong to current user |

---

## 8.3 Quiz Generation

| Field | Rule |
|---|---|
| `quizProblemCount` | required, 1~50 recommended |
| `keywordIds` | optional array of UUID |
| `difficulty` | optional enum |
| `documentId` | must belong to current user |
| `document.analysis_status` | must be `ANALYZED` |

---

## 8.4 Answer Submission

| Field | Rule |
|---|---|
| `quizProblemId` | required UUID |
| `userAnswer` | required unless skipped answer is allowed |
| `usedHint` | boolean |
| `hintLevelUsed` | nullable int, 1~3 |
| `elapsedSeconds` | nullable positive int |

---

## 9. Access Control Rules

Every service must enforce user ownership.

| Resource | Ownership Rule |
|---|---|
| Subject | `subjects.user_id = currentUser.id` |
| Document | `documents.user_id = currentUser.id` (or current implementation `document_entity.ownerUserId = currentUser.id`) |
| Quiz | `quiz.user_id = currentUser.id` |
| Quiz Attempt | `quiz_attempts.user_id = currentUser.id` |
| QuizProblem Attempt | `quiz_problem_attempts.user_id = currentUser.id` |
| Mastery Score | `mastery_scores.user_id = currentUser.id` |
| Mock Exam | `mock_exams.user_id = currentUser.id` |

---

## 10. Implementation Order

Recommended order for Codex or developers:

1. Define enums.
2. Implement TypeORM entities from `02-database-spec.md`.
3. Create migrations.
4. Implement AuthModule with Google OAuth and native register/login.
5. Implement SubjectModule.
6. Implement DocumentModule with upload only.
7. Implement PDF analysis pipeline.
8. Implement KeywordModule.
9. Implement QuizModule.
10. Implement QuizAttemptModule.
11. Implement MasteryModule.
12. Implement DashboardModule.
13. Implement MockExamModule.
14. Add integration tests.
15. Add E2E happy path test.

---

## 11. Minimum E2E Scenario

The system should support this scenario:

1. User logs in with Google or native email/password.
2. User creates a subject.
3. User uploads a PDF to the subject.
4. System analyzes the PDF.
5. System extracts cleaned markdown, stores document chunks, generates summary, and extracts chunk-grounded keywords.
6. User generates a lecture quiz.
7. User starts a quiz attempt.
8. User submits answers.
9. System grades answers.
10. System updates mastery.
11. User views dashboard.
12. User generates mock exam based on weak keywords.

---

## 12. Prompt Template for Codex

Use this prompt when asking Codex to implement features.

```text
Use the SudoCampus specification files as the source of truth.

Reference files:
- docs/01-requirements-summary.md
- docs/02-database-spec.md
- docs/03-implementation-spec.md

Task:
[WRITE TASK HERE]

Rules:
1. Use NestJS, TypeORM, and PostgreSQL.
2. Use UUID primary keys.
3. Follow the table names, column names, enums, and relationships defined in `02-database-spec.md`.
4. Do not invent new tables unless the task explicitly requires it.
5. Keep controller logic thin and put business logic in services.
6. Add DTO validation for API inputs.
7. All user-owned resource access must check ownership.
8. Return JSON responses.
9. If any requirement is ambiguous, ask before implementing.
10. Implement only the requested module or feature.
```

---

## 13. Open QuizProblems for Team

These must be decided before final implementation.

| QuizProblem | Why it matters |
|---|---|
| Will the app support email/password login or only Google OAuth? | Affects `users` and auth module |
| Will delete be hard delete or soft delete? | Affects cascade policy and recovery |
| Where will PDF files be stored? | Affects `file_url` and deployment |
| How exact should short-answer grading be? | Affects grading logic |
| Will mock exams reuse existing quiz_problems or always generate new quiz_problems? | Affects `quiz_problems` reuse model |
| Is `MULTIPLE_CHOICE` required in MVP? | Existing design mentions multiple-choice, but SRS emphasizes objective/short answer |
| Should AI generation logs be stored? | Useful for debugging but not MVP essential |


