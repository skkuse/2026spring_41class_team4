# SudoCampus Requirements Summary

> 목적: 이 문서는 SudoCampus의 요구사항 명세서, 디자인 명세서, 모델링 문서를 바탕으로 구현에 필요한 핵심 요구사항을 정리한 개발용 요약 문서이다.  
> 사용 대상: 팀 개발자, LLM 기반 코딩 도구, Codex, 백엔드/프론트엔드 구현자.
> Terminology: 본 프로젝트에서는 퀴즈 안의 개별 문제를 `Question`이 아니라 `QuizProblem`으로 부른다.

---

## 1. Project Overview

SudoCampus는 대학생이 PDF 형식의 강의자료를 업로드하면, AI를 통해 강의자료를 분석하고 요약하며, 핵심 키워드를 추출하고, 이를 바탕으로 퀴즈와 모의고사를 생성하는 웹 기반 학습 플랫폼이다.

시스템은 사용자의 퀴즈 풀이 결과를 저장하고, 문서 기반 키워드별 학습 숙련도인 `mastery`를 갱신하여 사용자가 자신의 강한 개념과 취약한 개념을 파악할 수 있도록 한다.

---

## 2. Core Problem

기존 AI 학습 도구는 PDF를 업로드하면 요약이나 퀴즈를 제공할 수 있지만, 다음과 같은 한계가 있다.

1. 문서 전체 기준으로 문제를 생성하여 개념 단위 이해도를 파악하기 어렵다.
2. 사용자별 학습 상태를 반영하지 못한다.
3. 사용자가 어떤 키워드 또는 개념을 잘 모르고 있는지 추적하기 어렵다.
4. 퀴즈 생성 이후의 풀이 이력과 mastery가 체계적으로 관리되지 않는다.

SudoCampus는 이러한 문제를 해결하기 위해 PDF 기반 학습자료를 cleaned markdown chunk와 키워드 단위로 구조화하고, 사용자 풀이 이력을 기반으로 mastery를 갱신한다.

---

## 3. MVP Scope

초기 MVP는 다음 기능을 포함한다.

| Area | MVP Feature |
|---|---|
| Authentication | Google OAuth 로그인, Native email/password 회원가입 및 로그인, 회원가입 인증번호 검증, 아이디 찾기, 비밀번호 찾기/재설정 |
| Subject Management | 과목 생성, 과목 목록 조회 |
| Document Management | PDF 강의자료 업로드, PDF 분석 상태 관리 |
| Document Analysis | cleaned markdown 기반 문서 텍스트 추출, document chunk 저장, 문서 전체 요약, 근거 chunk 기반 키워드 추출 |
| Quiz Generation | 강의자료 기반 퀴즈 생성 |
| Quiz Taking | 객관식/단답형 문제 풀이, 답안 제출 |
| Answer Evaluation | 정답 여부 판정, 해설/피드백 제공 |
| Mastery Management | 사용자·과목·키워드별 mastery score 갱신 |
| Dashboard | 강한 키워드, 약한 키워드, mastery, coverage 조회 |
| Mock Exam | mastery 기반 모의고사 생성 |

---

## 4. Out of Scope for Initial MVP

아래 항목은 초기 MVP에서는 제외하거나 단순화한다.

| Feature | Treatment |
|---|---|
| PPT, Word, 영상 파일 업로드 | PDF만 지원 |
| OCR 기반 스캔본 PDF 처리 | 향후 확장 |
| 고도화된 서술형 자동 채점 | 단답형 문자열 비교 또는 단순 AI 평가로 제한 |
| 대규모 사용자 통계 기반 난이도 보정 | 향후 확장 |
| 문제 난이도 자동 재학습 | 향후 확장 |
| 상세 AI 비용/토큰 분석 | 향후 `ai_generation_logs`로 확장 |
| 모바일 최적화 | 데스크톱/노트북 중심으로 설계 |

---

## 5. Main User

### Learner

주 사용자는 시험을 준비하는 대학생이다.

사용자는 다음 활동을 수행한다.

1. Google 계정 또는 native email/password 계정으로 로그인한다.
2. native 회원가입 시 이메일 인증번호를 입력하여 계정을 검증한다.
3. 과목을 생성한다.
4. 과목에 PDF 강의자료를 업로드한다.
5. PDF 분석 결과와 요약을 확인한다.
6. 추출된 키워드를 기반으로 퀴즈를 푼다.
7. 퀴즈 결과와 해설을 확인한다.
8. 대시보드에서 강한 키워드, 약한 키워드, mastery, coverage를 확인한다.
9. 취약 키워드 중심의 모의고사를 생성해 푼다.

---

## 6. Key Domain Terms

| Term | Meaning |
|---|---|
| User | SudoCampus를 사용하는 학습자 |
| Subject | 사용자가 등록한 과목 |
| Document | 사용자가 업로드한 PDF 강의자료 |
| Keyword | 강의자료에서 추출된 핵심 개념 또는 학습 단위. MVP에서는 document chunk sourceRef를 가진다. |
| Quiz | 여러 문제를 묶은 퀴즈 세트 |
| QuizProblem | AI가 생성한 개별 문제 |
| Choice | 객관식 문제의 선택지 |
| Quiz Attempt | 사용자가 퀴즈를 1회 응시한 기록 |
| QuizProblem Attempt | 사용자가 개별 문제에 제출한 답안 기록 |
| Mastery | 특정 키워드에 대한 사용자의 이해도/숙련도 |
| Document Chunk | cleaned markdown에서 파생된 페이지 단위 강의자료 텍스트 조각 |
| Coverage | 과목 또는 문서의 키워드 중 퀴즈에서 다뤄진 비율 |
| Mock Exam | 사용자의 취약 키워드와 중요 키워드를 반영한 모의고사 |

---

## 7. Functional Requirements Summary

### 7.1 Authentication

| ID | Requirement |
|---|---|
| AUTH-01 | 시스템은 Google OAuth 기반 로그인을 지원해야 한다. |
| AUTH-02 | 시스템은 native email/password 회원가입과 로그인을 지원해야 한다. |
| AUTH-03 | 시스템은 native 회원가입 시 이메일 인증번호를 검증해야 한다. |
| AUTH-04 | 시스템은 비밀번호를 평문으로 저장하지 않고 hash로 저장해야 한다. |
| AUTH-05 | 시스템은 아이디 찾기 기능을 제공해야 하며, SudoCampus의 아이디는 이메일 주소로 정의한다. |
| AUTH-06 | 시스템은 이름과 이메일 확인 후 인증번호 검증을 통해 비밀번호 재설정을 지원해야 한다. |
| AUTH-07 | 시스템은 로그인한 사용자를 내부 user ID로 식별해야 한다. |
| AUTH-08 | 인증되지 않은 사용자는 주요 기능에 접근할 수 없어야 한다. |
| AUTH-09 | 사용자는 본인의 학습 데이터에만 접근할 수 있어야 한다. |
| AUTH-10 | 인증번호는 평문으로 저장하지 않고 hash로 저장해야 한다. |


---

### 7.2 Subject Management

| ID | Requirement |
|---|---|
| SUBJECT-01 | 사용자는 과목을 생성할 수 있어야 한다. |
| SUBJECT-02 | 사용자는 본인이 생성한 과목 목록을 조회할 수 있어야 한다. |
| SUBJECT-03 | 과목은 사용자와 연결되어야 한다. |
| SUBJECT-04 | 과목 단위로 강의자료, 퀴즈, mastery를 관리한다. |

---

### 7.3 PDF Upload and Analysis

| ID | Requirement |
|---|---|
| DOC-01 | 사용자는 과목에 PDF 강의자료를 업로드할 수 있어야 한다. |
| DOC-02 | 시스템은 업로드된 PDF의 메타데이터를 저장해야 한다. |
| DOC-03 | 시스템은 PDF에서 LLM 입력용 cleaned markdown을 추출할 수 있어야 한다. |
| DOC-04 | 시스템은 cleaned markdown을 page 단위 document chunk로 저장해야 한다. |
| DOC-05 | 시스템은 document chunk를 요약, 키워드 추출, 퀴즈 생성의 근거 context로 활용해야 한다. |
| DOC-06 | 시스템은 문서 전체 요약 결과를 저장해야 한다. |
| DOC-07 | 시스템은 문서 분석 상태를 관리해야 한다. |

---

### 7.4 Keyword Extraction

| ID | Requirement |
|---|---|
| KEYWORD-01 | 시스템은 document chunk에서 핵심 키워드 또는 개념을 추출해야 한다. |
| KEYWORD-02 | 키워드는 문서 단위로 저장하며, 과목 단위 조회는 해당 과목의 문서들에 속한 키워드를 집계해 제공한다. |
| KEYWORD-03 | 키워드는 근거 document chunk와 문제에 연결될 수 있어야 한다. |
| KEYWORD-04 | 키워드는 importance score를 가질 수 있다. |
| KEYWORD-05 | 키워드는 mastery 계산의 기준 데이터로 사용된다. |

---

### 7.5 Quiz Generation

| ID | Requirement |
|---|---|
| QUIZ-01 | 시스템은 키워드와 해당 키워드에 연결된 강의자료 chunk를 기반으로 퀴즈를 생성해야 한다. |
| QUIZ-02 | 시스템은 사용자 mastery 정보를 반영하여 문제 난이도와 범위를 조정할 수 있어야 한다. |
| QUIZ-03 | 퀴즈는 여러 문제로 구성된다. |
| QUIZ-04 | 문제는 객관식 또는 단답형을 지원한다. |
| QUIZ-05 | 문제는 정답, 해설, 난이도, 관련 키워드를 포함해야 한다. |
| QUIZ-06 | 객관식 문제는 선택지를 가진다. |

---

### 7.5.1 Quiz Difficulty Control Requirement

| ID | Requirement |
|---|---|
| QUIZ-DIFF-01 | The system should not rely only on the LLM's direct difficulty label. |
| QUIZ-DIFF-02 | The system should generate quiz problems using a structured item model based on target keywords and evidence document chunks. |
| QUIZ-DIFF-03 | The system should use Bloom's Taxonomy to represent the cognitive level of generated quiz problems. |
| QUIZ-DIFF-04 | The system should use Webb's DOK to represent the reasoning depth of generated quiz problems. |
| QUIZ-DIFF-05 | The system should use Evidence-Centered Design so that each quiz problem provides evidence for keyword mastery. |
| QUIZ-DIFF-06 | The system should use Automatic Item Generation principles to constrain LLM-based quiz generation. |
| QUIZ-DIFF-07 | The backend should calculate final EASY/MEDIUM/HARD difficulty from structured difficulty features. |
| QUIZ-DIFF-08 | The LLM's predicted difficulty should be treated as a reference value, not as the final stored difficulty. |

### 7.6 Answer Submission and Evaluation

| ID | Requirement |
|---|---|
| ATTEMPT-01 | 사용자는 퀴즈 문제에 답안을 제출할 수 있어야 한다. |
| ATTEMPT-02 | 시스템은 정답 여부를 판정해야 한다. |
| ATTEMPT-03 | 시스템은 사용자 답안, 정답 여부, 제출 시각, 힌트 사용 여부를 저장해야 한다. |
| ATTEMPT-04 | 시스템은 해설과 피드백을 제공해야 한다. |
| ATTEMPT-05 | 퀴즈 응시 이력과 문제별 답안 이력을 분리해 저장한다. |

---

### 7.7 Mastery Management

| ID | Requirement |
|---|---|
| MASTERY-01 | 시스템은 사용자·키워드별 mastery score를 저장해야 하며, 과목 단위 mastery는 해당 과목의 문서와 키워드를 통해 집계한다. |
| MASTERY-02 | 시스템은 문제 풀이 결과를 기반으로 mastery score를 갱신해야 한다. |
| MASTERY-03 | 시스템은 정답률, 난이도, 힌트 사용 여부를 mastery 계산에 반영할 수 있어야 한다. |
| MASTERY-04 | 시스템은 mastery를 기반으로 strong keyword와 weak keyword를 식별해야 한다. |

---

### 7.8 Mock Exam

| ID | Requirement |
|---|---|
| MOCK-01 | 시스템은 과목 단위로 모의고사를 생성할 수 있어야 한다. |
| MOCK-02 | 모의고사는 사용자의 취약 키워드와 중요 키워드를 반영해야 한다. |
| MOCK-03 | 모의고사도 일반 퀴즈와 동일하게 문제, 답안 제출, 채점, mastery 갱신 흐름을 사용한다. |
| MOCK-04 | 모의고사 생성 조건은 별도 테이블에 저장할 수 있다. |

---

## 8. Main Feature Flows

### 8.1 Login Flow

#### Google Login

1. 사용자가 Google 로그인 버튼을 클릭한다.
2. 프론트엔드는 Google OAuth 인증을 진행한다.
3. 백엔드는 Google OAuth ID token을 검증한다.
4. 기존 사용자이면 내부 `users` 정보를 조회한다.
5. 신규 사용자이면 `users`와 `oauth_accounts`를 생성한다.
6. 백엔드는 JWT access/refresh token을 반환한다.

#### Native Signup/Login

1. 사용자가 이메일을 입력하고 회원가입 인증번호를 요청한다.
2. 백엔드는 인증번호를 생성하고 hash로 저장한 뒤 이메일로 발송한다.
3. 사용자는 이름, 이메일, 비밀번호, 인증번호를 입력하여 회원가입을 완료한다.
4. 백엔드는 인증번호를 검증하고 `users`, `password_credentials`를 생성한다.
5. 사용자는 이메일과 비밀번호로 로그인한다.
6. 백엔드는 password hash를 검증하고 JWT access/refresh token을 반환한다.

#### Find ID / Password Reset

1. 아이디 찾기는 이메일 주소와 이름을 입력받아 가입 정보 일치 여부를 확인한다.
2. 일치하는 경우 시스템은 마스킹된 이메일 주소를 반환할 수 있다.
3. 비밀번호 찾기는 이메일 주소와 이름을 입력받고, 일치하는 사용자가 있으면 인증번호를 발송한다.
4. 사용자는 인증번호와 새 비밀번호를 입력하여 비밀번호를 재설정한다.
5. 백엔드는 새 비밀번호를 hash로 저장하고 기존 refresh token 무효화를 위해 `token_version`을 증가시킨다.

---

### 8.2 PDF Upload and Analysis Flow

1. 사용자가 과목을 선택한다.
2. 사용자가 PDF 파일을 업로드한다.
3. 서버는 `documents`에 PDF 메타데이터를 저장한다.
4. 서버는 PDF에서 LLM 입력용 cleaned markdown을 추출한다.
5. 서버는 cleaned markdown의 `# Page {number} - {heading}` 단위를 기준으로 page-level `document_chunks`를 저장한다.
6. AI 또는 요약 로직을 통해 document chunks 기반 문서 전체 요약을 생성한다.
7. 요약 결과를 `documents.overall_summary`에 저장한다.
8. AI는 document chunks에서 키워드를 추출하고, 각 키워드의 근거가 되는 sourceRefs를 함께 반환한다.
9. 키워드를 `keywords`에 저장한다. 이때 키워드는 `document_id`를 통해 업로드된 문서에 연결된다.
10. 키워드와 근거 chunk의 관계를 `keyword_chunks`에 저장한다.
11. 같은 이름의 키워드가 다른 문서에 이미 존재하더라도, 현재 문서의 키워드는 별도 row로 저장한다.
12. 문서 분석 상태를 `ANALYZED`로 변경한다.

---

### 8.3 Lecture Quiz Generation Flow

1. 사용자가 강의자료별 퀴즈 생성을 요청한다.
2. 서버는 문서 분석 결과와 문서 키워드를 조회한다.
3. 서버는 선택된 키워드 또는 추천 대상 키워드를 조회한다.
4. 서버는 `keyword_chunks -> document_chunks`를 통해 키워드와 연결된 강의자료 chunk를 조회한다.
5. 서버는 키워드, 사용자 mastery, 관련 강의자료 chunk를 AI 입력으로 구성한다.
6. 서버는 AI API를 호출해 강의자료 chunk에 근거한 문제를 생성한다.
7. `quiz`에 퀴즈 세트를 생성한다.
8. `quiz_problems`에 문제를 저장한다.
9. 객관식 문제의 경우 `quiz_problem_choices`에 선택지를 저장한다.
10. `quiz_problem_keywords`에 문제와 키워드의 관계를 저장한다.
11. 생성된 퀴즈를 사용자에게 반환한다.

---

### 8.4 Submit Answer and Update Mastery Flow

1. 사용자가 문제 답안을 제출한다.
2. 서버는 문제 정답을 조회한다.
3. 서버는 정답 여부를 판단한다.
4. 서버는 `quiz_problem_attempts`에 문제별 답안 기록을 저장한다.
5. 서버는 관련 키워드를 `quiz_problem_keywords`에서 조회한다.
6. 각 키워드에 대해 최근 정답률, 난이도 가중 점수, 힌트 미사용 보너스를 계산한다.
7. `mastery_scores`를 생성 또는 갱신한다.
8. 퀴즈 전체 제출 완료 시 `quiz_attempts`를 갱신한다.
9. 서버는 정답 여부, 해설, 피드백, 갱신된 mastery 정보를 반환한다.

---

### 8.5 Mock Exam Flow

1. 사용자가 모의고사 생성을 요청한다.
2. 서버는 사용자의 `mastery_scores`를 조회한다.
3. 서버는 weak keyword와 중요도가 높은 keyword를 선정한다.
4. 서버는 선정된 키워드를 기반으로 문제를 생성하거나 기존 문제를 선택한다.
5. `quiz`에 `quiz_type = MOCK_EXAM`인 퀴즈를 생성한다.
6. `mock_exams`에 모의고사 생성 조건을 저장한다.
7. `quiz_problems`, `quiz_problem_choices`, `quiz_problem_keywords`를 저장한다.
8. 사용자는 일반 퀴즈와 동일한 화면에서 모의고사를 푼다.
9. 제출 후 일반 퀴즈와 동일하게 mastery를 갱신한다.

---

## 9. Non-Functional Requirements Summary

| Area | Requirement |
|---|---|
| Performance | 50페이지 이하 PDF의 텍스트 추출은 일반 서버 환경에서 1분 이내를 목표로 한다. |
| Performance | 사용자 mastery와 키워드 기반 10개 퀴즈 생성은 평균 20초 이내를 목표로 한다. |
| Performance | 답안 이력 저장과 mastery 갱신은 3초 이내를 목표로 한다. |
| Security | 인증되지 않은 사용자는 주요 기능에 접근할 수 없어야 한다. |
| Security | 사용자는 본인의 과목, 문서, 퀴즈 이력, mastery만 조회할 수 있어야 한다. |
| Maintainability | Auth, Subject, Document, Keyword, Quiz, Attempt, Mastery, Mock Exam 모듈을 분리한다. |
| Portability | 웹 브라우저 기반으로 Windows, macOS 등 주요 OS에서 접근 가능해야 한다. |

---

## 10. Implementation Guidance for LLM/Codex

LLM 또는 Codex가 이 문서를 사용할 때는 다음 원칙을 따른다.

1. 이 문서는 기능 구현의 요구사항 요약이다.
2. DB 구조는 `02-database-spec.md`를 기준으로 한다.
3. API와 모듈 구현은 `03-implementation-spec.md`를 기준으로 한다.
4. 명시되지 않은 테이블을 임의로 추가하지 않는다.
5. 애매한 요구사항은 구현 전에 질문한다.
6. MVP 범위를 먼저 구현하고, 확장 기능은 별도 작업으로 분리한다.
