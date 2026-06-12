# 🚀 PDF AI Tutor - Implementation Steps

## Step 1. NestJS 프로젝트 생성

- NestJS 프로젝트 생성
- document module 생성

요구사항:

- document.controller.ts
- document.service.ts 생성

---

## Step 2. PDF 업로드 API 구현

요구사항:

- POST /documents/upload
- multer 사용
- PDF 파일만 허용

결과:

- 업로드 성공하면 file 정보 반환

---

## Step 3. OpenDataLoader 연동

요구사항:

- pdf-parser.service.ts 생성
- convert() 사용
- JSON + Markdown 생성

결과:

- 파싱 결과 반환

---

## Step 4. 페이지 데이터 추출

요구사항:

- parsedJson에서 페이지 단위 추출
- pageNumber, text 구조 생성

---

## Step 5. OpenAI 요약 API 연결

요구사항:

- 1페이지만 테스트
- 요약 생성

---

## Step 6. 전체 페이지 반복 처리

요구사항:

- 모든 페이지 loop
- 요약 생성

---

## Step 7. 퀴즈 생성 추가

요구사항:

- 각 페이지마다 질문 3개 생성

---

## Step 8. DB 연결 (Prisma)

요구사항:

- Document / Page / Summary / Quiz 모델 생성
- DB 저장

---

## Step 9. API 응답 구조 정리

요구사항:

- 페이지별 결과 반환

---

## Step 10. 리팩토링

요구사항:

- service 분리
- 코드 정리

```

```
