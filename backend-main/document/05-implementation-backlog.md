# SudoCampus Implementation Backlog

## Purpose

This document lists the backend features that must be implemented for the SudoCampus MVP.

Source of truth:

- docs/01-requirements-summary.md
- docs/02-database-spec.md
- docs/03-implementation-spec.md

---

## Status Legend

| Status      | Meaning                                        |
| ----------- | ---------------------------------------------- |
| TODO        | Not implemented                                |
| IN_PROGRESS | Implementation started                         |
| PARTIAL     | Some files exist but feature is incomplete     |
| DONE        | Implemented and manually verified              |
| TESTED      | Implemented and covered by tests               |
| BLOCKED     | Cannot proceed because team decision is needed |

---

## Priority 1. Database Foundation

| ID    | Feature                 | Description                                                                                            | Related Tables | Status |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------ | -------------- | ------ |
| DB-01 | Define enums            | Define oauth_provider, document_status, quiz_type, quiz_problem_type, difficulty_level, attempt_status | enum types     | TODO   |
| DB-02 | Create TypeORM entities | Implement entities exactly from database spec                                                          | all MVP tables including document_chunks, keyword_chunks | TODO   |
| DB-03 | Create migrations       | Generate PostgreSQL migrations                                                                         | all MVP tables | TODO   |
| DB-04 | Add relationships       | Add TypeORM relations and FK mappings                                                                  | all MVP tables | TODO   |
| DB-05 | Add unique constraints  | Add required unique constraints                                                                        | all MVP tables | TODO   |
| DB-06 | Add password credential schema | Add native auth credential table and relationship | password_credentials | TODO |

---

## Priority 2. Authentication

| ID      | Feature                | API                           | Related Tables        | Status |
| ------- | ---------------------- | ----------------------------- | --------------------- | ------ |
| AUTH-01 | Google OAuth login     | POST /auth/google             | users, oauth_accounts | TODO   |
| AUTH-02 | Native register verification code request | POST /auth/register/verification-code | auth_verification_codes | TODO |
| AUTH-03 | Native register        | POST /auth/register           | users, password_credentials, auth_verification_codes | TODO |
| AUTH-04 | Native login           | POST /auth/login              | users, password_credentials | TODO |
| AUTH-05 | Find ID                | POST /auth/find-id            | users | TODO |
| AUTH-06 | Password reset verification code request | POST /auth/password-reset/verification-code | users, auth_verification_codes | TODO |
| AUTH-07 | Password reset confirm | POST /auth/password-reset/confirm | users, password_credentials, auth_verification_codes | TODO |
| AUTH-08 | Current user lookup    | GET /auth/me                  | users                 | TODO   |
| AUTH-09 | Auth guard             | protected APIs                | users                 | TODO   |
| AUTH-10 | Ownership guard/helper | service-level ownership check | user-owned tables     | TODO   |
| AUTH-11 | Mail delivery service  | internal                      | auth_verification_codes | TODO |

---

## Priority 3. Subject Management

| ID         | Feature            | API                         | Related Tables                                | Status  |
| ---------- | ------------------ | --------------------------- | --------------------------------------------- | ------- |
| SUBJECT-01 | Create subject     | POST /subjects              | subjects                                      | TODO    |
| SUBJECT-02 | List subjects      | GET /subjects               | subjects                                      | TODO    |
| SUBJECT-03 | Get subject detail | GET /subjects/:subjectId    | subjects, documents, keywords, mastery_scores | TODO    |
| SUBJECT-04 | Delete subject     | DELETE /subjects/:subjectId | subjects                                      | BLOCKED |

Blocker:

- Need team decision: hard delete cascade or soft delete?

---

## Priority 4. Document Upload and Analysis

| ID     | Feature                   | API                                        | Related Tables                                      | Status |
| ------ | ------------------------- | ------------------------------------------ | --------------------------------------------------- | ------ |
| DOC-01 | Upload PDF                | POST /subjects/:subjectId/documents/upload | documents                                           | TODO   |
| DOC-02 | Get document status       | GET /documents/:documentId/status          | documents                                           | TODO   |
| DOC-03 | Get document detail       | GET /documents/:documentId                 | documents, keywords | PARTIAL   |
| DOC-04 | Analyze PDF with cleaned markdown chunks | POST /documents/:documentId/analyze        | documents, document_chunks, keywords, keyword_chunks | PARTIAL   |

---

## Priority 5. Keyword Management

| ID         | Feature                | API                                 | Related Tables              | Status |
| ---------- | ---------------------- | ----------------------------------- | --------------------------- | ------ |
| KEYWORD-01 | Extract chunk-grounded keywords | internal | document_chunks, keywords | PARTIAL   |
| KEYWORD-02 | Store keywords with document context | internal | keywords | PARTIAL   |
| KEYWORD-03 | Store keyword source refs | internal | keyword_chunks, document_chunks | TODO |
| KEYWORD-04 | Get subject keywords   | GET /subjects/:subjectId/keywords   | documents, keywords, keyword_chunks, document_chunks, mastery_scores    | PARTIAL   |
| KEYWORD-05 | Get document keywords with sourceRefs | GET /documents/:documentId/keywords | keywords, keyword_chunks, document_chunks | PARTIAL   |

---

## Priority 6. Quiz Generation

| ID      | Feature                        | API                                 | Related Tables                               | Status |
| ------- | ------------------------------ | ----------------------------------- | -------------------------------------------- | ------ |
| QUIZ-01 | Generate lecture quiz from keyword-related chunks | POST /documents/:documentId/quiz | document_chunks, keyword_chunks, quiz, quiz_problems | TODO   |
| QUIZ-02 | Save choices                   | internal                            | quiz_problem_choices                         | TODO   |
| QUIZ-03 | Link quiz problems to keywords | internal                            | quiz_problem_keywords                        | TODO   |
| QUIZ-04 | Get quiz for solving           | GET /quiz/:quizId                   | quiz, quiz_problems, quiz_problem_choices | TODO   |

Generation input requirement:

- Do not send only keyword names to the AI model.
- Load selected keyword source chunks through `keyword_chunks -> document_chunks`.
- The generated quiz problem must be grounded in the provided lecture chunks and linked back to keywords through `quiz_problem_keywords`.

Security requirement:

- Do not expose answer_text while solving.
- Do not expose is_correct before submission.

---

## Priority 7. Quiz Attempts and Answer Submission

| ID         | Feature               | API                               | Related Tables                                      | Status |
| ---------- | --------------------- | --------------------------------- | --------------------------------------------------- | ------ |
| ATTEMPT-01 | Start quiz attempt    | POST /quiz/:quizId/attempts       | quiz_attempts                                       | TODO   |
| ATTEMPT-02 | Submit one answer     | POST /attempts/:attemptId/answers | quiz_problem_attempts                               | TODO   |
| ATTEMPT-03 | Submit entire attempt | POST /attempts/:attemptId/submit  | quiz_attempts, quiz_problem_attempts                | TODO   |
| ATTEMPT-04 | Get review result     | GET /attempts/:attemptId/review   | quiz_attempts, quiz_problem_attempts, quiz_problems | TODO   |

---

## Priority 8. Mastery

| ID         | Feature                     | API                              | Related Tables                        | Status |
| ---------- | --------------------------- | -------------------------------- | ------------------------------------- | ------ |
| MASTERY-01 | Calculate mastery score     | internal                         | mastery_scores                        | TODO   |
| MASTERY-02 | Update mastery after answer | internal                         | mastery_scores, quiz_problem_attempts | TODO   |
| MASTERY-03 | Get subject mastery         | GET /subjects/:subjectId/mastery | mastery_scores, keywords              | TODO   |

Formula:
mastery_score =
0.7 \* recent_correct_rate

- 0.2 \* difficulty_weighted_score
- 0.1 \* no_hint_bonus

---

## Priority 9. Dashboard

| ID           | Feature              | API                                | Related Tables                                                        | Status |
| ------------ | -------------------- | ---------------------------------- | --------------------------------------------------------------------- | ------ |
| DASHBOARD-01 | Get dashboard        | GET /subjects/:subjectId/dashboard | subjects, documents, keywords, quiz, quiz_attempts, mastery_scores | TODO   |
| DASHBOARD-02 | Calculate coverage   | internal                           | keywords, quiz_problem_keywords                                       | TODO   |
| DASHBOARD-03 | Find strong keywords | internal                           | mastery_scores                                                        | TODO   |
| DASHBOARD-04 | Find weak keywords   | internal                           | mastery_scores                                                        | TODO   |

---

## Priority 10. Mock Exam

| ID      | Feature                 | API                                  | Related Tables                     | Status |
| ------- | ----------------------- | ------------------------------------ | ---------------------------------- | ------ |
| MOCK-01 | Generate mock exam      | POST /subjects/:subjectId/mock-exams | quiz, mock_exams, quiz_problems | TODO   |
| MOCK-02 | Select weak keywords    | internal                             | mastery_scores, keywords           | TODO   |
| MOCK-03 | Save mock exam settings | internal                             | mock_exams                         | TODO   |
| MOCK-04 | Link mock exam problems | internal                             | mock_exam_problems                 | TODO   |

---

## Priority 11. Auth Extensions Backlog

| ID | Feature | Description | Status |
|---|---|---|---|
| AUTHX-01 | Email verification | Send verification mail and verify token | TODO |
| AUTHX-02 | Password reset | Request/reset password via email token | TODO |
| AUTHX-03 | Account linking | Safely link Google-only account and native credential after email verification | TODO |

---

## Priority 12. Tests

| ID      | Feature               | Description                                                              | Status |
| ------- | --------------------- | ------------------------------------------------------------------------ | ------ |
| TEST-01 | Entity tests          | Check entity relationships and constraints                               | TODO   |
| TEST-02 | Subject API tests     | Create/list/detail subject                                               | TODO   |
| TEST-03 | Document upload tests | Upload PDF and status check                                              | TODO   |
| TEST-04 | Quiz attempt tests    | Start attempt, submit answer, grade                                      | TODO   |
| TEST-05 | E2E happy path        | Login ??subject ??upload ??analyze ??quiz ??answer ??mastery ??dashboard | TODO   |

