# SudoCampus Database Specification

> 紐⑹쟻: ??臾몄꽌??SudoCampus???곗씠?곕쿋?댁뒪 ?ㅺ퀎瑜??뺤쓽?쒕떎.  
> ?ъ슜 ??? ? 媛쒕컻?? LLM 湲곕컲 肄붾뵫 ?꾧뎄, Codex, TypeORM Entity ?묒꽦?? PostgreSQL migration ?묒꽦??  
> Source of Truth: ??臾몄꽌??DB 援ы쁽 ??湲곗? 臾몄꽌濡??ъ슜?쒕떎.
> Terminology: 蹂??꾨줈?앺듃?먯꽌???댁쫰 ?덉쓽 媛쒕퀎 臾몄젣瑜?`Question`???꾨땲??`QuizProblem`?쇰줈 遺瑜몃떎.

---

## 1. Purpose

This document defines the logical database schema for SudoCampus.

It is intended to be used by developers and LLM-based coding tools to generate:

- PostgreSQL DDL
- TypeORM entities
- Database migrations
- Repository classes
- Database-related service logic
- ERD diagrams

The schema supports:

- Google OAuth login
- native email/password signup and login
- signup verification code validation
- find ID by email and name
- password reset with verification code
- subject management
- PDF upload and document-level analysis
- keyword extraction
- quiz generation
- quiz problem choices
- answer submission
- quiz attempt history
- mastery score update
- mock exam generation

---

## 2. Global Design Rules

### 2.1 Naming Rules

| Item | Rule |
|---|---|
| Table names | snake_case plural |
| Column names | snake_case |
| Primary key | `id uuid` |
| Foreign key | `{referenced_table_singular}_id` |
| Timestamp columns | `created_at`, `updated_at` |
| Enum columns | snake_case enum values or DB enum types |

---

### 2.2 Primary Key Rule

All main tables use UUID primary keys.

```sql
id uuid primary key
```

Reason:

- Avoid exposing sequential IDs.
- Easier to merge data across environments.
- Suitable for distributed generation.

---

### 2.3 Timestamp Rule

Most domain tables include:

| Column | Type | Nullable |
|---|---|---|
| `created_at` | timestamp | No |
| `updated_at` | timestamp | No |

Mapping tables may only require `created_at` if updates are not expected.

---

### 2.4 Ownership Rule

All user-owned data must be traceable to `users.id`.

Tables that directly store user-owned resources should contain `user_id`.

Examples:

- `subjects.user_id`
- `documents.user_id`
- `quiz.user_id`
- `quiz_attempts.user_id`
- `quiz_problem_attempts.user_id`
- `mastery_scores.user_id`
- `mock_exams.user_id`

---

## 3. Design Decisions

### D1. User and authentication credentials are separated

The `users` table stores the internal user identity.  
The `oauth_accounts` table stores Google OAuth provider information.  
The `password_credentials` table stores native email/password authentication data.  
The `auth_verification_codes` table stores hashed verification codes for signup verification and password reset.

Reason:

- The service needs a stable internal user ID.
- OAuth provider information may change.
- More providers can be added later.
- Native password login can be supported without adding `password_hash` directly to `users`.
- Verification code records can be managed independently from user profile data.
- User-owned data should not depend directly on Google provider IDs or password credentials.

---

### D2. Lecture quiz and mock exams share the `quiz` table

Both lecture quiz and mock exams are stored in `quiz`.

They are distinguished by:

```text
quiz.quiz_type = LECTURE | MOCK_EXAM
```

Reason:

- Both have quiz_problems.
- Both have choices.
- Both have attempts.
- Both update mastery.
- Reusing one structure avoids duplicate tables.

---

### D3. QuizProblems belong to a quiz in the MVP

In the MVP version, each `quiz problem` belongs to one `quiz`.

Reason:

- AI generates problems in the context of a specific lecture quiz or mock exam.
- This is simpler than designing a reusable quiz problem bank.
- A quiz problem bank can be added later if needed.

---

### D4. Keywords are managed at document level

The `keywords` table stores each keyword with `document_id`.

Each keyword is extracted and stored in the context of one uploaded PDF document. QuizProblems are connected to keywords through the `quiz_problem_keywords` mapping table.

Reason:

- The same keyword name can appear in multiple PDF documents but represent different learning scope or difficulty.
- Lecture quiz generation is document-based, so the extracted keyword should preserve the document context.
- Mastery should not be affected by the same keyword name from a previous document when the current document teaches a different topic.
- Subject keyword screens can group keywords by name and show the source document.

---

### D4.1. Lecture text is stored as cleaned document chunks

The PDF analysis pipeline stores text used by AI features as `document_chunks`.

`document_chunks` are derived from the cleaned markdown representation of the uploaded PDF, not from raw parser JSON or extracted image files. Each chunk usually corresponds to one page in the initial MVP.

Reason:

- Quiz generation must be grounded in the uploaded lecture material, not only in keyword names.
- Keyword extraction must preserve which page or chunk supports each keyword.
- Later quiz generation can select only the chunks related to weak keywords instead of sending the whole document to the AI model.
- Image extraction and raw JSON generation may remain available internally for debugging or future multimodal extensions, but they are not the main MVP AI input.

---

### D5. Mastery is stored as latest state

The `mastery_scores` table stores the latest mastery state for each:

```text
user + keyword
```

Detailed history is derived from:

- `quiz_attempts`
- `quiz_problem_attempts`

Reason:

- Dashboard queries need fast access to current mastery.
- Detailed recalculation remains possible using attempt history.


---

### D7. Hints are stored directly in `quiz_problems` for MVP

The MVP stores hints as:

- `hint_level_1`
- `hint_level_2`
- `hint_level_3`

Reason:

- The number of hint levels is fixed.
- Simpler than a separate `hints` table.
- Can be normalized later if needed.

---

### D8. AuthN/AuthZ hardening delta (2026-05-24)

The authentication hardening migration added authorization/account-state fields:

- `users.role` (`USER` | `ADMIN`)
- `users.status` (`ACTIVE` | `SUSPENDED` | `DELETED`)
- `users.token_version` (for global token invalidation)

And ownership verification for document resources is currently backed by:

- `document_entity.ownerUserId` (prototype table/column naming)

---

## 4. Entity Overview

| Entity | Purpose | MVP |
|---|---|---|
| `users` | Internal user account | Yes |
| `oauth_accounts` | Google OAuth account mapping | Yes |
| `password_credentials` | Native password credential for email/password login | Yes |
| `auth_verification_codes` | Signup and password-reset verification code storage | Yes |
| `subjects` | User-created course/subject | Yes |
| `documents` | Uploaded PDF metadata | Yes |
| `document_chunks` | Cleaned lecture text chunks used for AI grounding | Yes |
| `keywords` | Extracted concept/keyword | Yes |
| `quiz` | Lecture quiz or mock exam quiz set | Yes |
| `quiz_problems` | Individual generated problem | Yes |
| `quiz_problem_choices` | Multiple choice options | Yes |
| `keyword_chunks` | Keyword-source chunk evidence mapping | Yes |
| `quiz_problem_keywords` | QuizProblem-keyword mapping | Yes |
| `quiz_attempts` | User's quiz attempt session | Yes |
| `quiz_problem_attempts` | User's answer for each quiz problem | Yes |
| `mastery_scores` | Current mastery by user/keyword | Yes |
| `mock_exams` | Mock exam generation setting | MVP+ |
| `mock_exam_problems` | Mock exam quiz problem ordering | MVP+ |

---

## 5. Table Specifications

## 5.1 users

### Purpose

Stores internal user accounts.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Internal user ID |
| `email` | varchar(255) | No | Unique | User email |
| `name` | varchar(100) | No |  | User display name |
| `profile_image_url` | varchar(500) | Yes |  | Profile image URL from Google |
| `role` | user_role | No |  | Authorization role |
| `status` | user_status | No |  | Account lifecycle state |
| `token_version` | int | No |  | Token invalidation version |
| `email_verified_at` | timestamp | Yes |  | Email verification completed time for native accounts |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One user has many `oauth_accounts`.
- One user has zero or one `password_credentials`.
- One user has many `auth_verification_codes`.
- One user has zero or one `password_credentials`.
- One user has many `subjects`.
- One user has many `documents`.
- One user has many `quiz`.
- One user has many `quiz_attempts`.
- One user has many `quiz_problem_attempts`.
- One user has many `mastery_scores`.
- One user has many `mock_exams`.

### Implementation Notes

- Do not store Google provider ID directly in this table.
- Email should be unique.
- Do not store `password_hash` directly in this table.
- Native email/password login uses the `password_credentials` table.
- Native signup sets `email_verified_at` after a valid signup verification code is confirmed.

---

## 5.2 oauth_accounts

### Purpose

Stores external OAuth provider account information.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | OAuth account row ID |
| `user_id` | uuid | No | FK | References `users.id` |
| `provider` | oauth_provider | No | Unique pair | OAuth provider, currently `GOOGLE` |
| `provider_user_id` | varchar(255) | No | Unique pair | Google account unique ID |
| `provider_email` | varchar(255) | Yes |  | Email returned by provider |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(provider, provider_user_id)`

### Relationships

- Many OAuth accounts belong to one `user`.

---

## 5.3 password_credentials

### Purpose

Stores password hash information for native email/password authentication.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Password credential row ID |
| `user_id` | uuid | No | FK, Unique | References `users.id` |
| `password_hash` | varchar(255) | No |  | bcrypt hashed password |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `user_id`

### Relationships

- One password credential belongs to one `user`.

### Implementation Notes

- This table is used only for native email/password login.
- `users.password_hash` must not be created.
- Passwords must be stored only after bcrypt hashing.
- Raw passwords must never be stored or logged.
- Password reset updates `password_credentials.password_hash`.

---

## 5.4 subjects

### Purpose

Stores user-created subjects/courses.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Subject ID |
| `user_id` | uuid | No | FK | Owner user |
| `name` | varchar(100) | No | Unique pair | Subject name |
| `description` | text | Yes |  | Subject description |
| `thumbnail_url` | varchar(500) | Yes |  | Subject image |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(user_id, name)`

### Relationships

- One user has many subjects.
- One subject has many documents.
- One subject has many quiz.
- One subject has many mastery scores.
- One subject has many mock exams.

---

## 5.5 documents

### Purpose

Stores uploaded PDF lecture material metadata and analysis status.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Document ID |
| `subject_id` | uuid | No | FK | Subject containing this document |
| `user_id` | uuid | No | FK | Owner user |
| `title` | varchar(255) | No |  | Display title |
| `original_file_name` | varchar(255) | No |  | Original uploaded file name |
| `file_url` | varchar(500) | No |  | Stored PDF URL/path |
| `file_size_bytes` | bigint | Yes |  | File size |
| `mime_type` | varchar(100) | Yes |  | Usually `application/pdf` |
| `page_count` | int | Yes |  | Number of pages |
| `analysis_status` | document_status | No |  | Upload/analysis status |
| `analysis_error_message` | text | Yes |  | Error message if analysis failed |
| `overall_summary` | text | Yes |  | Optional whole document summary |
| `uploaded_at` | timestamp | No |  | Upload time |
| `analyzed_at` | timestamp | Yes |  | Analysis completed time |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One subject has many documents.
- One user has many documents.
- One document has many document chunks.
- One document has many keywords.
- One document can have many quiz.

### Implementation Notes

- Set `analysis_status = UPLOADED` immediately after upload.
- Set `analysis_status = PROCESSING` during parsing.
- Set `analysis_status = ANALYZED` when cleaned markdown extraction, document chunk storage, summary generation, keyword extraction, and keyword-source mapping finish.
- Set `analysis_status = FAILED` if parsing or AI processing fails.
- Current prototype code additionally uses `document_entity.ownerUserId` for ownership checks.
- The MVP AI input should be based on cleaned markdown text, stored as `document_chunks`. The main analyze flow should not require image extraction or raw parser JSON output.

---

## 5.6 document_chunks

### Purpose

Stores cleaned lecture text chunks derived from an uploaded document.

In the MVP, one chunk usually corresponds to one PDF page parsed from `cleaned-openai-input.md` style content. These chunks are the source material used for summary generation, keyword extraction, and later quiz generation.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Document chunk ID |
| `document_id` | uuid | No | FK, Unique pair | Source document |
| `page_number` | int | No | Unique pair | PDF page number |
| `heading` | varchar(255) | Yes |  | Page or section heading |
| `content` | text | No |  | Cleaned main text content |
| `visual_note` | text | Yes |  | Note about visual-only or incomplete extraction, if any |
| `display_order` | int | No |  | Order inside the document |
| `token_count` | int | Yes |  | Approximate token count for AI input budgeting |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(document_id, page_number)`

### Relationships

- One document has many document chunks.
- One document chunk can support many keywords through `keyword_chunks`.

### Implementation Notes

- `document_chunks` are generated from cleaned markdown, not raw parser JSON.
- Pages with no extractable text may still be stored so page ordering and visual notes are preserved.
- Quiz generation should load chunks related to selected keywords instead of passing the whole markdown document to the AI model.

---


## 5.8 keywords

### Purpose

Stores key concepts extracted from a specific lecture document.

Keywords are stored with `document_id`. If the same keyword name appears in multiple documents, each document keeps its own keyword row.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Keyword ID |
| `document_id` | uuid | No | FK, Unique pair | Source document |
| `name` | varchar(100) | No | Unique pair | Keyword name |
| `description` | text | Yes |  | Concept description |
| `importance_score` | decimal(5,4) | Yes |  | 0.0000 ~ 1.0000. Importance inside the source document. |
| `is_learning_objective_core` | boolean | No |  | Whether this is a core learning objective in the source document |
| `appears_multiple_times` | boolean | No |  | Whether this appears multiple times in the source document |
| `is_prerequisite_for_other_concepts` | boolean | No |  | Whether this is prerequisite concept in the source document |
| `is_used_in_assessment` | boolean | No |  | Whether this is used in generated quiz_problems |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(document_id, name)`

### Relationships

- One document has many keywords.
- One keyword belongs to one document.
- One keyword can be linked to many source chunks through `keyword_chunks`.
- One keyword can be linked to many quiz_problems.
- One keyword can have many mastery scores.

### Implementation Notes

- Do not create a separate `document_keywords` mapping table in the MVP.
- Subject-level keyword lists should be built by joining `subjects -> documents -> keywords` and grouping same-name keywords for display only.
- Same-name keywords from different documents must remain separate rows so mastery and quiz generation preserve document context.
- A keyword should be stored with at least one source reference in `keyword_chunks` whenever possible. Keywords without source evidence are low-quality and should generally be ignored for quiz generation.

---

## 5.9 keyword_chunks

### Purpose

Mapping table between extracted keywords and the cleaned document chunks that support them.

This table is the grounding bridge between a keyword and the actual lecture material. Quiz generation uses this table to fetch lecture context for selected keywords.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Row ID |
| `keyword_id` | uuid | No | FK, Unique pair | Keyword |
| `document_chunk_id` | uuid | No | FK, Unique pair | Source document chunk |
| `relevance_score` | decimal(5,4) | Yes |  | 0.0000 ~ 1.0000 relevance between keyword and chunk |
| `evidence_text` | text | Yes |  | Short supporting excerpt from the chunk |
| `created_at` | timestamp | No |  | Created time |

### Constraints

- Unique: `(keyword_id, document_chunk_id)`

### Relationships

- One keyword can have many source chunks.
- One document chunk can support many keywords.

### Implementation Notes

- Keyword extraction should return source references containing at minimum `chunk_id` or `page_number` plus supporting `evidence_text`.
- Quiz generation should prefer chunks with higher `relevance_score` for the selected keyword.

---

## 5.11 quiz

### Purpose

Stores quiz sets. Used for both lecture quiz and mock exams.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Quiz ID |
| `subject_id` | uuid | No | FK | Subject |
| `document_id` | uuid | Yes | FK | Source document for lecture quiz |
| `user_id` | uuid | No | FK | User who owns/generated quiz |
| `quiz_type` | quiz_type | No |  | `LECTURE` or `MOCK_EXAM` |
| `title` | varchar(255) | No |  | Quiz title |
| `description` | text | Yes |  | Quiz description |
| `quiz_problem_count` | int | Yes |  | Number of quiz_problems |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One subject has many quiz.
- One document can have many lecture quiz.
- One quiz has many quiz_problems.
- One quiz has many quiz attempts.
- One mock exam references one quiz.

### Implementation Notes

- For lecture quiz, `document_id` should be set.
- For mock exams, `document_id` may be null.
- `quiz_type` determines behavior.

---

## 5.12 quiz_problems

### Purpose

Stores AI-generated individual quiz_problems.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | QuizProblem ID |
| `quiz_id` | uuid | No | FK | Parent quiz |
| `problem_text` | text | No |  | QuizProblem body |
| `quiz_problem_type` | quiz_problem_type | No |  | Single choice, multiple choice, short answer |
| `answer_text` | text | No |  | Correct answer or answer reference |
| `explanation` | text | Yes |  | Explanation |
| `difficulty` | difficulty_level | No |  | Difficulty |
| `hint_level_1` | text | Yes |  | First hint |
| `hint_level_2` | text | Yes |  | Second hint |
| `hint_level_3` | text | Yes |  | Third hint |
| `display_order` | int | No |  | Order inside quiz |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One quiz has many quiz_problems.
- One quiz problem has many choices.
- One quiz problem has many quiz problem keywords.
- One quiz problem has many quiz problem attempts.

---

### Difficulty Metadata Policy

`quiz_problems.difficulty` stores the backend-calculated final difficulty.

The LLM may return assessment metadata during generation, including Bloom level, DOK level, difficulty features, predicted difficulty, confidence, and rationale. In the MVP schema, these metadata fields are not required columns. They may be kept in AI response validation logs or added later if detailed item analysis is needed.

Recommended future extension columns, if needed:

| Column | Type | Nullable | Description |
|---|---|---:|---|
| `bloom_level` | varchar(30) | Yes | Bloom cognitive level used during generation. |
| `dok_level` | int | Yes | Webb Depth of Knowledge level. |
| `difficulty_features` | jsonb | Yes | Structured difficulty features returned by the LLM. |
| `model_predicted_difficulty` | difficulty_level | Yes | LLM-estimated difficulty before backend calculation. |
| `difficulty_confidence` | decimal(5,4) | Yes | LLM confidence for predicted difficulty. |
| `difficulty_rationale` | text | Yes | Short explanation for predicted difficulty. |

Do not add these future columns unless explicitly required. The MVP should continue to use the existing `difficulty` column for the final value.

## 5.13 quiz_problem_choices

### Purpose

Stores choices for single-choice and multiple-choice quiz_problems.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Choice ID |
| `quiz_problem_id` | uuid | No | FK | Parent quiz problem |
| `choice_text` | text | No |  | Choice text |
| `is_correct` | boolean | No |  | Whether this choice is correct |
| `display_order` | int | No |  | Choice order |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One quiz problem has many choices.

### Implementation Notes

- Short-answer quiz_problems do not need choices.
- Single-choice quiz_problems should have exactly one correct choice.
- Multiple-choice quiz_problems may have multiple correct choices.

---

## 5.14 quiz_problem_keywords

### Purpose

Mapping table between quiz_problems and keywords.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Row ID |
| `quiz_problem_id` | uuid | No | FK, Unique pair | QuizProblem |
| `keyword_id` | uuid | No | FK, Unique pair | Keyword |
| `weight` | decimal(5,4) | Yes |  | Keyword relevance in quiz problem |
| `created_at` | timestamp | No |  | Created time |

### Constraints

- Unique: `(quiz_problem_id, keyword_id)`

### Implementation Notes

- This table is required for mastery update.
- When a quiz problem is answered, related keywords are loaded from this table.

---

## 5.15 quiz_attempts

### Purpose

Stores each quiz-taking session by a user.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Attempt ID |
| `quiz_id` | uuid | No | FK | Quiz |
| `user_id` | uuid | No | FK | User |
| `status` | attempt_status | No |  | Attempt status |
| `started_at` | timestamp | No |  | Start time |
| `submitted_at` | timestamp | Yes |  | Submit time |
| `total_quiz_problems` | int | Yes |  | Total quiz problem count |
| `correct_count` | int | Yes |  | Number of correct answers |
| `score` | decimal(5,2) | Yes |  | Score |
| `feedback` | text | Yes |  | Overall feedback |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Relationships

- One user has many quiz attempts.
- One quiz has many quiz attempts.
- One quiz attempt has many quiz problem attempts.

---

## 5.16 quiz_problem_attempts

### Purpose

Stores user's answer and result for each quiz problem.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | QuizProblem attempt ID |
| `quiz_attempt_id` | uuid | No | FK, Unique pair | Parent quiz attempt |
| `quiz_problem_id` | uuid | No | FK, Unique pair | Target quiz problem |
| `user_id` | uuid | No | FK | User |
| `user_answer` | text | Yes |  | Submitted answer |
| `is_correct` | boolean | Yes |  | Correctness |
| `used_hint` | boolean | No |  | Whether hint was used |
| `hint_level_used` | int | Yes |  | Highest hint level used |
| `elapsed_seconds` | int | Yes |  | Time spent on this quiz problem |
| `feedback` | text | Yes |  | QuizProblem-level feedback |
| `submitted_at` | timestamp | Yes |  | Submit time |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(quiz_attempt_id, quiz_problem_id)`

### Implementation Notes

- This table is the main source for mastery calculation.
- `user_id` is duplicated intentionally for easier access control and query filtering.

---

## 5.17 mastery_scores

### Purpose

Stores the current mastery state for each user-keyword combination. Because each keyword is tied to a document, this represents mastery in a specific document context.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Mastery row ID |
| `user_id` | uuid | No | FK, Unique pair | User |
| `keyword_id` | uuid | No | FK, Unique pair | keyword |
| `mastery_score` | decimal(5,4) | No |  | 0.0000 ~ 1.0000 |
| `attempts` | int | No |  | Attempt count |
| `correct_count` | int | No |  | Correct count |
| `recent_correct_rate` | decimal(5,4) | Yes |  | Recent correct rate |
| `difficulty_weighted_score` | decimal(5,4) | Yes |  | Difficulty weighted score |
| `no_hint_bonus` | decimal(5,4) | Yes |  | Bonus for no hint |
| `last_attempted_at` | timestamp | Yes |  | Last attempt time |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Constraints

- Unique: `(user_id, keyword_id)`

### Implementation Notes

MVP mastery formula:

```text
mastery_score =
  0.7 * recent_correct_rate
+ 0.2 * difficulty_weighted_score
+ 0.1 * no_hint_bonus
```

---

## 5.18 mock_exams

### Purpose

Stores mock exam generation settings.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Mock exam ID |
| `quiz_id` | uuid | No | FK, Unique | Underlying quiz |
| `subject_id` | uuid | No | FK | Subject |
| `user_id` | uuid | No | FK | User |
| `quiz_problem_count` | int | No |  | Requested quiz problem count |
| `target_weak_keywords` | boolean | No |  | Whether weak keywords are targeted |
| `generated_from_mastery` | boolean | No |  | Whether mastery was used |
| `created_at` | timestamp | No |  | Created time |
| `updated_at` | timestamp | No |  | Updated time |

### Implementation Notes

- The actual quiz_problems are still stored in `quiz_problems`.
- The underlying quiz should have `quiz_type = MOCK_EXAM`.

---

## 5.19 mock_exam_problems

### Purpose

Optional mapping table for mock exam quiz problem ordering.

### Columns

| Column | Type | Nullable | Key | Description |
|---|---|---:|---|---|
| `id` | uuid | No | PK | Row ID |
| `mock_exam_id` | uuid | No | FK, Unique pair | Mock exam |
| `quiz_problem_id` | uuid | No | FK, Unique pair | QuizProblem |
| `display_order` | int | No |  | Order in mock exam |

### Constraints

- Unique: `(mock_exam_id, quiz_problem_id)`

---

## 6. Enums

### 6.1 oauth_provider

| Value | Meaning |
|---|---|
| `GOOGLE` | Google OAuth |

---

### 6.2 document_status

| Value | Meaning |
|---|---|
| `UPLOADED` | PDF uploaded but not processed |
| `PROCESSING` | Analysis in progress |
| `ANALYZED` | Analysis completed |
| `FAILED` | Analysis failed |

---

### 6.3 quiz_type

| Value | Meaning |
|---|---|
| `LECTURE` | Lecture/document-based quiz |
| `MOCK_EXAM` | Personalized mock exam |

---

### 6.4 quiz_problem_type

| Value | Meaning |
|---|---|
| `SINGLE_CHOICE` | One correct choice |
| `MULTIPLE_CHOICE` | Multiple correct choices |
| `SHORT_ANSWER` | Short text answer |

---

### 6.5 difficulty_level

| Value | Meaning |
|---|---|
| `EASY` | Easy |
| `MEDIUM` | Medium |
| `HARD` | Hard |

---

### 6.6 attempt_status

| Value | Meaning |
|---|---|
| `IN_PROGRESS` | User started but has not submitted |
| `SUBMITTED` | User submitted answers |
| `GRADED` | System graded the attempt |

---

### 6.7 user_role

| Value | Meaning |
|---|---|
| `USER` | Default authenticated user |
| `ADMIN` | Elevated administrative role |

---

### 6.8 user_status

| Value | Meaning |
|---|---|
| `ACTIVE` | Account can authenticate and access APIs |
| `SUSPENDED` | Account is blocked from access |
| `DELETED` | Account is logically retired/disabled |

---

### 6.9 verification_purpose

| Value | Meaning |
|---|---|
| `SIGNUP_VERIFICATION` | Verification code for native signup |
| `PASSWORD_RESET` | Verification code for password reset |

---

### 6.10 verification_delivery_channel

| Value | Meaning |
|---|---|
| `EMAIL` | Verification code delivered by email |
| `SMS` | Verification code delivered by SMS, future extension |

---

## 7. Relationship Summary

| Relationship | Cardinality | Description |
|---|---:|---|
| `users` ??`oauth_accounts` | 1:N | One user can have multiple OAuth accounts |
| `users` ??`password_credentials` | 1:0..1 | One user can have one native password credential |
| `users` ??`auth_verification_codes` | 1:N | One user can have multiple verification code records |
| `users` ??`password_credentials` | 1:0..1 | One user can have one native password credential |
| `users` ??`subjects` | 1:N | One user can create multiple subjects |
| `subjects` ??`documents` | 1:N | One subject can contain multiple PDFs |
| `documents` ??`document_chunks` | 1:N | Cleaned lecture text chunks under a document |
| `documents` ??`keywords` | 1:N | Keywords are managed under a document |
| `subjects` ??`quiz` | 1:N | One subject has many quiz |
| `documents` ??`quiz` | 1:N | One document can have many lecture quiz |
| `quiz` ??`quiz_problems` | 1:N | One quiz contains many quiz_problems |
| `quiz_problems` ??`quiz_problem_choices` | 1:N | One quiz problem has many choices |
| `keywords` ??`document_chunks` | N:M | Via `keyword_chunks` |
| `quiz_problems` ??`keywords` | N:M | Via `quiz_problem_keywords` |
| `users` ??`quiz_attempts` | 1:N | One user has many quiz attempts |
| `quiz_attempts` ??`quiz_problem_attempts` | 1:N | One quiz attempt has many quiz problem attempts |
| `users` + `keywords` ??`mastery_scores` | unique state | Current mastery state for a keyword |
| `quiz` ??`mock_exams` | 1:0..1 | Mock exam metadata for quiz |
| `mock_exams` ??`quiz_problems` | N:M | Via `mock_exam_problems` |

---

## 8. Indexes and Constraints

### Required Unique Constraints

| Table | Constraint |
|---|---|
| `users` | `email` unique |
| `password_credentials` | `user_id` unique |
| `oauth_accounts` | `(provider, provider_user_id)` unique |
| `password_credentials` | `user_id` unique |
| `subjects` | `(user_id, name)` unique |
| `document_chunks` | `(document_id, page_number)` unique |
| `keywords` | `(document_id, name)` unique |
| `keyword_chunks` | `(keyword_id, document_chunk_id)` unique |
| `quiz_problem_keywords` | `(quiz_problem_id, keyword_id)` unique |
| `quiz_problem_attempts` | `(quiz_attempt_id, quiz_problem_id)` unique |
| `mastery_scores` | `(user_id, keyword_id)` unique |
| `mock_exams` | `quiz_id` unique |
| `mock_exam_problems` | `(mock_exam_id, quiz_problem_id)` unique |

---

## 9. MVP Tables

Required for MVP implementation:

- `users`
- `oauth_accounts`
- `password_credentials`
- `auth_verification_codes`
- `password_credentials`
- `subjects`
- `documents`
- `document_chunks`
- `keywords`
- `keyword_chunks`
- `quiz`
- `quiz_problems`
- `quiz_problem_choices`
- `quiz_problem_keywords`
- `quiz_attempts`
- `quiz_problem_attempts`
- `mastery_scores`

---

## 10. MVP+ / Extension Tables

Useful for richer implementation:

- `mock_exams`
- `mock_exam_problems`

Future extension candidates:

- `email_verification_tokens`
- `password_reset_tokens`
- `ai_generation_logs`
- `quiz_problem_statistics`
- `dashboard_snapshots`
- `uploaded_files`
- `hint_usages`

Do not implement future extension candidates unless explicitly requested.

---

## 11. DBML Schema for dbdiagram.io

```dbml
Enum oauth_provider {
  GOOGLE
}

Enum user_role {
  USER
  ADMIN
}

Enum user_status {
  ACTIVE
  SUSPENDED
  DELETED
}

Enum verification_purpose {
  SIGNUP_VERIFICATION
  PASSWORD_RESET
}

Enum verification_delivery_channel {
  EMAIL
  SMS
}

Enum document_status {
  UPLOADED
  PROCESSING
  ANALYZED
  FAILED
}

Enum quiz_type {
  LECTURE
  MOCK_EXAM
}

Enum quiz_problem_type {
  SINGLE_CHOICE
  MULTIPLE_CHOICE
  SHORT_ANSWER
}

Enum difficulty_level {
  EASY
  MEDIUM
  HARD
}

Enum attempt_status {
  IN_PROGRESS
  SUBMITTED
  GRADED
}

Table users {
  id uuid [pk]
  email varchar(255) [not null, unique]
  name varchar(100) [not null]
  profile_image_url varchar(500)
  role user_role [not null, default: 'USER']
  status user_status [not null, default: 'ACTIVE']
  token_version int [not null, default: 0]
  email_verified_at timestamp
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table oauth_accounts {
  id uuid [pk]
  user_id uuid [not null]
  provider oauth_provider [not null]
  provider_user_id varchar(255) [not null]
  provider_email varchar(255)
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (provider, provider_user_id) [unique]
  }
}

Table password_credentials {
  id uuid [pk]
  user_id uuid [not null, unique]
  password_hash varchar(255) [not null]
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table subjects {
  id uuid [pk]
  user_id uuid [not null]
  name varchar(100) [not null]
  description text
  thumbnail_url varchar(500)
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (user_id, name) [unique]
  }
}

Table documents {
  id uuid [pk]
  subject_id uuid [not null]
  user_id uuid [not null]
  title varchar(255) [not null]
  original_file_name varchar(255) [not null]
  file_url varchar(500) [not null]
  file_size_bytes bigint
  mime_type varchar(100)
  page_count int
  analysis_status document_status [not null]
  analysis_error_message text
  overall_summary text
  uploaded_at timestamp [not null]
  analyzed_at timestamp
  created_at timestamp [not null]
  updated_at timestamp [not null]
}



Table document_chunks {
  id uuid [pk]
  document_id uuid [not null]
  page_number int [not null]
  heading varchar(255)
  content text [not null]
  visual_note text
  display_order int [not null]
  token_count int
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (document_id, page_number) [unique]
  }
}

Table keywords {
  id uuid [pk]
  document_id uuid [not null]
  name varchar(100) [not null]
  description text
  importance_score decimal(5,4)
  is_learning_objective_core boolean [default: false]
  appears_multiple_times boolean [default: false]
  is_prerequisite_for_other_concepts boolean [default: false]
  is_used_in_assessment boolean [default: false]
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (document_id, name) [unique]
  }
}


Table keyword_chunks {
  id uuid [pk]
  keyword_id uuid [not null]
  document_chunk_id uuid [not null]
  relevance_score decimal(5,4)
  evidence_text text
  created_at timestamp [not null]

  indexes {
    (keyword_id, document_chunk_id) [unique]
  }
}

Table quiz {
  id uuid [pk]
  subject_id uuid [not null]
  document_id uuid
  user_id uuid [not null]
  quiz_type quiz_type [not null]
  title varchar(255) [not null]
  description text
  quiz_problem_count int
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table quiz_problems {
  id uuid [pk]
  quiz_id uuid [not null]
  problem_text text [not null]
  quiz_problem_type quiz_problem_type [not null]
  answer_text text [not null]
  explanation text
  difficulty difficulty_level [not null]
  hint_level_1 text
  hint_level_2 text
  hint_level_3 text
  display_order int [not null]
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table quiz_problem_choices {
  id uuid [pk]
  quiz_problem_id uuid [not null]
  choice_text text [not null]
  is_correct boolean [not null, default: false]
  display_order int [not null]
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table quiz_problem_keywords {
  id uuid [pk]
  quiz_problem_id uuid [not null]
  keyword_id uuid [not null]
  weight decimal(5,4)
  created_at timestamp [not null]

  indexes {
    (quiz_problem_id, keyword_id) [unique]
  }
}

Table quiz_attempts {
  id uuid [pk]
  quiz_id uuid [not null]
  user_id uuid [not null]
  status attempt_status [not null]
  started_at timestamp [not null]
  submitted_at timestamp
  total_quiz_problems int
  correct_count int
  score decimal(5,2)
  feedback text
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table quiz_problem_attempts {
  id uuid [pk]
  quiz_attempt_id uuid [not null]
  quiz_problem_id uuid [not null]
  user_id uuid [not null]
  user_answer text
  is_correct boolean
  used_hint boolean [not null, default: false]
  hint_level_used int
  elapsed_seconds int
  feedback text
  submitted_at timestamp
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (quiz_attempt_id, quiz_problem_id) [unique]
  }
}

Table mastery_scores {
  id uuid [pk]
  user_id uuid [not null]
  keyword_id uuid [not null]
  mastery_score decimal(5,4) [not null]
  attempts int [not null, default: 0]
  correct_count int [not null, default: 0]
  recent_correct_rate decimal(5,4)
  difficulty_weighted_score decimal(5,4)
  no_hint_bonus decimal(5,4)
  last_attempted_at timestamp
  created_at timestamp [not null]
  updated_at timestamp [not null]

  indexes {
    (user_id, keyword_id) [unique]
  }
}

Table mock_exams {
  id uuid [pk]
  quiz_id uuid [not null, unique]
  subject_id uuid [not null]
  user_id uuid [not null]
  quiz_problem_count int [not null]
  target_weak_keywords boolean [not null, default: true]
  generated_from_mastery boolean [not null, default: true]
  created_at timestamp [not null]
  updated_at timestamp [not null]
}

Table mock_exam_problems {
  id uuid [pk]
  mock_exam_id uuid [not null]
  quiz_problem_id uuid [not null]
  display_order int [not null]

  indexes {
    (mock_exam_id, quiz_problem_id) [unique]
  }
}

Ref: oauth_accounts.user_id > users.id
Ref: password_credentials.user_id > users.id

Ref: subjects.user_id > users.id

Ref: documents.subject_id > subjects.id
Ref: documents.user_id > users.id



Ref: document_chunks.document_id > documents.id
Ref: keywords.document_id > documents.id
Ref: keyword_chunks.keyword_id > keywords.id
Ref: keyword_chunks.document_chunk_id > document_chunks.id


Ref: quiz.subject_id > subjects.id
Ref: quiz.document_id > documents.id
Ref: quiz.user_id > users.id

Ref: quiz_problems.quiz_id > quiz.id

Ref: quiz_problem_choices.quiz_problem_id > quiz_problems.id

Ref: quiz_problem_keywords.quiz_problem_id > quiz_problems.id
Ref: quiz_problem_keywords.keyword_id > keywords.id

Ref: quiz_attempts.quiz_id > quiz.id
Ref: quiz_attempts.user_id > users.id

Ref: quiz_problem_attempts.quiz_attempt_id > quiz_attempts.id
Ref: quiz_problem_attempts.quiz_problem_id > quiz_problems.id
Ref: quiz_problem_attempts.user_id > users.id

Ref: mastery_scores.user_id > users.id
Ref: mastery_scores.keyword_id > keywords.id

Ref: mock_exams.quiz_id > quiz.id
Ref: mock_exams.subject_id > subjects.id
Ref: mock_exams.user_id > users.id

Ref: mock_exam_problems.mock_exam_id > mock_exams.id
Ref: mock_exam_problems.quiz_problem_id > quiz_problems.id
```

---

## 12. Open QuizProblems

These items require team decision before final implementation.

| QuizProblem | Options | Current Recommendation |
|---|---|---|
| General email/password login? | Google only / Google + email login | MVP: Google + email login |
| Reusable quiz problem bank? | QuizProblems belong to quiz / reusable quiz problem pool | MVP: QuizProblems belong to quiz |
| Email verification? | Now / later | MVP: later, not implemented now |
| Short-answer grading? | Exact string match / normalized string match / AI grading | MVP: normalized string match |
| Document summary storage? | Document summary only / document + future section summaries | MVP: document-level overall summary |
| Hint storage? | Columns in quiz_problems / separate hints table | MVP: columns in quiz_problems |
| Mock exam tables? | Only quiz / quiz + mock_exams | Use quiz + mock_exams |
| Cascade delete policy? | Hard delete cascade / soft delete | Need team decision |
| File storage target? | local / S3-like object storage / DB blob | Need team decision |


