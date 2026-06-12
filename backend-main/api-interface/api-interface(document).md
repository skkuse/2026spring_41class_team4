# document_260526

```markdown
# SudoCampus Document API / DTO 명세 (공유용)

- 작성일: 2026-05-26
- 기준 코드:
  - `src/document/document.controller.ts`
  - `src/document/document.service.ts`
  - `src/document/entities/document.entity.ts`
  - `src/document/dto/*.ts`

이 문서는 현재 백엔드에 구현된 `Document` 관련 API와 DTO를 팀 공유용으로 정리한 문서입니다.

## 1) 공통 규칙

- 모든 Document API는 인증 필요 (`Authorization: Bearer <accessToken>`).
- 소유권 검증:
  - subject 기반 API: `SubjectsService.findOne(userId, subjectId)`로 소유권 확인
  - document 기반 API: `ownerUserId === currentUser.id` 확인
- 날짜 필드는 ISO 문자열로 직렬화됨 (`createdAt`, `updatedAt`).

---

## 2) API 목록 (현재 구현)

1. `POST /subjects/:subjectId/documents/upload`
2. `GET /subjects/:subjectId/documents`
3. `POST /documents/:documentId/analyze`
4. `GET /documents/:documentId`
5. `GET /documents/:documentId/status`
6. `PATCH /documents/:documentId/title`
7. `DELETE /documents/:documentId`

---

## 3) API 상세

### 3.1 POST `/subjects/:subjectId/documents/upload`

PDF 업로드 + 문서 row 생성.

- Path param
  - `subjectId: uuid`
- Body (`multipart/form-data`)
  - `file`: File (필수, PDF)
  - `title`: string (선택, 최대 255)

`title` 처리 규칙:
- 값이 있으면 해당 값 저장
- 값이 없으면 `originalFileName`에서 확장자 제거한 값으로 저장

Response:

```json
{
  "documentId": "uuid-or-varchar-id",
  "fileUrl": "/uploads/documents/<uuid>.pdf",
  "pageCount": 58,
  "analysisStatus": "UPLOADED",
  "canAnalyze": true
}
```

---

### 3.2 GET `/subjects/:subjectId/documents`

과목별 문서 목록 조회.

- Path param
  - `subjectId: uuid`
- 정렬
  - `createdAt DESC`

Response:

```json
[
  {
    "documentId": "uuid-or-varchar-id",
    "subjectId": "uuid",
    "title": "T4_1강",
    "originalFileName": "1.Introduction to SE(new).pdf",
    "fileUrl": "/uploads/documents/<uuid>.pdf",
    "pageCount": 58,
    "analysisStatus": "ANALYZED",
    "createdAt": "2026-05-25T15:51:25.673Z",
    "updatedAt": "2026-05-25T15:51:25.673Z"
  }
]
```

---

### 3.3 POST `/documents/:documentId/analyze`

문서 분석 수행(요약/키워드 저장 포함).

- Path param
  - `documentId: uuid-or-varchar-id`

Response:

```json
{
  "documentId": "uuid-or-varchar-id",
  "analysisStatus": "ANALYZED",
  "overallSummary": "markdown summary...",
  "keywordCount": 18,
  "keywords": [
    {
      "id": "uuid",
      "name": "Maintainability(유지보수성)",
      "importanceScore": 0.9
    }
  ]
}
```

---

### 3.4 GET `/documents/:documentId`

문서 상세 조회.

Response:

```json
{
  "documentId": "uuid-or-varchar-id",
  "subjectId": "uuid",
  "fileUrl": "/uploads/documents/<uuid>.pdf",
  "pageCount": 58,
  "analysisStatus": "ANALYZED",
  "overallSummary": "markdown summary...",
  "keywords": [
    {
      "id": "uuid",
      "name": "Waterfall model(폭포수 모델)",
      "importanceScore": 0.88
    }
  ]
}
```

---

### 3.5 GET `/documents/:documentId/status`

분석 상태 조회.

Response:

```json
{
  "documentId": "uuid-or-varchar-id",
  "analysisStatus": "UPLOADED",
  "errorMessage": null
}
```

---

### 3.6 PATCH `/documents/:documentId/title`

문서 제목 수정.

- Path param
  - `documentId: uuid-or-varchar-id`
- Body (`application/json`)

```json
{
  "title": "새 제목"
}
```

검증:
- string
- not empty
- max length 255

Response:

```json
{
  "documentId": "uuid-or-varchar-id",
  "subjectId": "uuid",
  "title": "새 제목",
  "originalFileName": "1.Introduction to SE(new).pdf",
  "fileUrl": "/uploads/documents/<uuid>.pdf",
  "pageCount": 58,
  "analysisStatus": "ANALYZED",
  "createdAt": "2026-05-25T15:51:25.673Z",
  "updatedAt": "2026-05-26T01:20:11.000Z"
}
```

---

### 3.7 DELETE `/documents/:documentId`

문서 삭제.

현재 삭제 범위:
- `document` row
- `document_pages`
- `document_keywords` mapping
- 업로드 PDF 파일(`fileUrl`가 로컬 `/uploads/documents/...`인 경우)
- parser output directory(`outputDir`)

Response:

```json
{
  "success": true
}
```

주의:
- subject 전역 `keywords` 마스터는 삭제하지 않음
- quiz/mastery 연계 삭제는 추후 모듈 구현 시 확장 예정(TODO)

---

## 4) DTO / Interface 요약

### UploadDocumentToSubjectDto

```ts
interface UploadDocumentToSubjectDto {
  title?: string; // optional, non-empty, <= 255
}
```

### UpdateDocumentTitleDto

```ts
interface UpdateDocumentTitleDto {
  title: string; // required, non-empty, <= 255
}
```

### UploadDocumentResponse

```ts
interface UploadDocumentResponse {
  documentId: string;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  canAnalyze: boolean;
}
```

### DocumentMetadataResponse (목록/제목수정 응답)

```ts
interface DocumentMetadataResponse {
  documentId: string;
  subjectId?: string | null;
  title?: string | null;
  originalFileName?: string | null;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
```

---

## 5) 에러 코드 가이드

- `400`: UUID 형식 오류, DTO 검증 오류(예: title 빈 문자열/255자 초과)
- `401`: 인증 실패(토큰 없음/유효하지 않음)
- `403`: 소유권 없음(다른 사용자 subject/document)
- `404`: subject 또는 document 없음
- `500`: 분석 실패 등 내부 오류

---

## 6) FE 연동 포인트

- PDF Viewer는 `GET /documents/:documentId` 또는 목록 API의 `fileUrl`을 그대로 사용
  - 예: `/uploads/documents/<uuid>.pdf`
- 업로드 시 사용자 지정 제목이 필요하면 `multipart/form-data`에 `title` key를 함께 전송
- 제목 변경 UX는 `PATCH /documents/:documentId/title` 사용

```