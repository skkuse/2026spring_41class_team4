# 📄 PDF 기반 AI 학습 시스템 설계 문서 (MVP)

## 1. 프로젝트 개요

본 시스템은 사용자가 업로드한 PDF 문서를 기반으로
**페이지 단위 학습 경험**을 제공하는 AI 학습 도구이다.

### 🎯 목표

- 전체 요약이 아닌 **페이지 단위 이해 중심 학습**
- 각 페이지마다:
  - 요약 생성
  - 이해도 확인 퀴즈 생성

- “이 내용이 어디서 나왔는지” 추적 가능

---

## 2. 핵심 기능

### 1) PDF 업로드

- 사용자가 PDF 파일 업로드

### 2) PDF 구조 분석

- OpenDataLoader를 사용하여:
  - 텍스트 추출
  - 페이지 구조 유지
  - Markdown / JSON 생성

### 3) 페이지 단위 분리

- 물리적인 PDF 분할 ❌
- 논리적인 페이지 단위 데이터 구성 ✅

### 4) AI 처리

- 페이지별:
  - 요약 생성
  - 퀴즈 생성

### 5) 결과 저장

- 페이지 단위로 DB 저장

---

## 3. 아키텍처

### 📌 전체 흐름

```
[Client]
   ↓
[NestJS API]
   ↓
[PDF 업로드]
   ↓
[OpenDataLoader 변환]
   ↓
[페이지별 데이터 생성]
   ↓
[OpenAI API 호출]
   ↓
[DB 저장]
   ↓
[Client 조회]
```

---

## 4. 기술 스택

- Backend: NestJS
- PDF 파싱: @opendataloader/pdf
- AI: OpenAI API
- DB: (예정) Prisma + PostgreSQL

---

## 5. 데이터 모델 설계

### Document

```
id
fileName
originalPath
createdAt
```

### Page

```
id
documentId
pageNumber
text
markdown
rawJson
```

### PageSummary

```
id
pageId
summary
```

### PageQuiz

```
id
pageId
question
answer
explanation
```

---

## 6. 처리 흐름 상세

### 1. PDF 업로드

- Controller에서 파일 수신
- multer 사용

---

### 2. PDF 파싱 (OpenDataLoader)

- PDF를 서버에 임시 저장
- convert() 실행

```ts
await convert([pdfPath], {
  outputDir,
  format: 'json,markdown',
});
```

- 결과:
  - JSON (구조 정보 포함)
  - Markdown (LLM 입력용)

---

### 3. 페이지 데이터 생성

- parsedJson에서 페이지 추출
- 페이지별:
  - pageNumber
  - text
  - markdown

---

### 4. AI 처리

#### 요약 생성

```text
다음 페이지 내용을 요약해줘:
{page_text}
```

#### 퀴즈 생성

```text
다음 내용을 기반으로 이해도 확인 질문 3개 만들어줘:
{page_text}
```

---

### 5. DB 저장

- Page 저장
- PageSummary 저장
- PageQuiz 저장

---

## 7. 설계 의사결정

### ❓ PDF를 장별 파일로 분리할 것인가?

❌ 하지 않음
✅ 페이지 단위 데이터로 처리

이유:

- 파일 분리는 불필요한 복잡도 증가
- 페이지 단위가 UX에 더 적합
- DB 구조화가 쉬움

---

### ❓ PDF 전체를 OpenAI에 보낼 것인가?

❌ 매번 PDF 전체 전달
✅ 페이지별 추출 데이터 전달

이유:

- 비용 절감
- 처리 속도 개선
- 페이지 단위 제어 가능

---

### ❓ 이미지/표 처리

기본:

- 텍스트 기반 처리

확장:

- 이미지 많은 페이지는 추후 보강

---

## 8. 구현 구조 (NestJS)

```
src/
 ├── document/
 │   ├── document.controller.ts
 │   ├── document.service.ts
 │   ├── pdf-parser.service.ts
 │   └── dto/
```

---

## 9. 주요 서비스 역할

### DocumentController

- 파일 업로드 처리

### PdfParserService

- OpenDataLoader 호출
- PDF → JSON/Markdown 변환

### DocumentService

- 페이지 데이터 생성
- AI 호출
- DB 저장

---

## 10. 개발 단계 (MVP)

### Step 1

- PDF 업로드

### Step 2

- OpenDataLoader 연동

### Step 3

- 페이지별 데이터 확인

### Step 4

- 1페이지 요약 생성

### Step 5

- 전체 페이지 반복

---

## 11. 향후 확장

- 페이지별 원문 하이라이트
- 이미지/표 해석 강화
- 학습 진행도 추적
- 사용자별 학습 기록
- 재생성 기능

---

## 12. 핵심 설계 원칙

- 파일이 아닌 **콘텐츠 단위로 처리**
- 전체가 아닌 **페이지 단위 학습**
- 단일 처리보다 **비동기 처리 고려**
- MVP는 단순하게, 확장은 구조적으로

---

## ✅ 최종 요약

- PDF는 쪼개지 않는다
- 페이지 단위로 구조화한다
- OpenDataLoader로 구조 추출한다
- OpenAI는 페이지별로 호출한다
- 결과는 DB에 저장한다

```

```
