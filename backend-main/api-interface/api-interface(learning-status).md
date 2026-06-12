# SudoCampus Learning Status API Interface

- 작성일: 2026-06-05
- 기준 코드:
  - `src/mastery/mastery.controller.ts`
  - `src/mastery/mastery.service.ts`
  - `src/mastery/dto/subject-mastery-response.dto.ts`
  - `src/document/document.controller.ts`

이 문서는 subject/document learning status API만 별도로 정리한다.

## 1) Common Rules

- 모든 API는 인증이 필요하다.
- Header: `Authorization: Bearer <accessToken>`
- `subjectId`, `documentId`는 UUID v4 형식이어야 한다.
- 사용자는 본인 소유 subject/document의 learning status만 조회할 수 있다.
- 새 테이블을 만들지 않는다.
- keyword ownership 모델은 변경하지 않는다.
- keyword는 document-scoped 데이터다.

## 2) API List

| Method | Endpoint | Status | Description |
| --- | --- | --- | --- |
| `GET` | `/subjects/:subjectId/learning-status` | LIVE | Subject-level mastery/coverage/strong/weak keywords |
| `GET` | `/documents/:documentId/learning-status` | LIVE | Document-level mastery/coverage/strong/weak keywords |

## 3) TypeScript Interfaces

```ts
export interface LearningStatusKeyword {
  keywordId: string;
  name: string;
  masteryScore: number; // 0.0 ~ 1.0
}

export interface SubjectLearningStatusResponse {
  subjectId: string;
  mastery: number; // 0.0 ~ 1.0
  coverage: number; // 0.0 ~ 1.0
  strongKeywords: LearningStatusKeyword[];
  weakKeywords: LearningStatusKeyword[];
}

export interface DocumentLearningStatusResponse {
  documentId: string;
  mastery: number; // 0.0 ~ 1.0
  coverage: number; // 0.0 ~ 1.0
  strongKeywords: LearningStatusKeyword[];
  weakKeywords: LearningStatusKeyword[];
}
```

## 4) GET `/subjects/:subjectId/learning-status`

Subject 단위 learning status를 조회한다.

### Response

```json
{
  "subjectId": "subject-uuid",
  "mastery": 0.55,
  "coverage": 0.5,
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

### Calculation

- ownership은 `subjects.user_id = currentUser.id`로 검증한다.
- subject keywords는 `subjects -> documents -> keywords` 경로로 집계한다.
- `mastery`는 subject 하위 keyword의 `mastery_scores.mastery_score` 평균이다.
- mastery row가 없으면 `mastery`는 `0`이다.
- `coverage`는 subject 하위 전체 keyword ID 중 `quiz_problem_keywords`에 연결된 distinct keyword ID 비율이다.
- 전체 keyword 수가 `0`이면 `coverage`는 `0`이다.
- coverage는 quiz problem 수가 아니라 keyword coverage다.

## 5) GET `/documents/:documentId/learning-status`

Document 단위 learning status를 조회한다.

### Response

```json
{
  "documentId": "document-uuid",
  "mastery": 0.55,
  "coverage": 0.5,
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

### Calculation

- ownership은 `documents.owner_user_id = currentUser.id`로 검증한다.
- document keywords는 `documents -> keywords` 경로로 집계한다.
- `mastery`는 document keyword의 `mastery_scores.mastery_score` 평균이다.
- mastery row가 없으면 `mastery`는 `0`이다.
- `coverage`는 document 전체 keyword ID 중 `quiz_problem_keywords`에 연결된 distinct keyword ID 비율이다.
- 전체 keyword 수가 `0`이면 `coverage`는 `0`이다.
- coverage는 quiz problem 수가 아니라 keyword coverage다.

## 6) Keyword Classification

- `strongKeywords`: `masteryScore >= 0.7`
- `weakKeywords`: `masteryScore < 0.4`
- MVP에서는 mastery row가 없는 keyword는 `strongKeywords`, `weakKeywords`에서 제외한다.

## 7) Error

| Status | Case |
| --- | --- |
| `400` | Path parameter is not UUID v4 |
| `401` | Missing or expired auth token |
| `403` | User does not own the document/subject |
| `404` | Document/subject not found |

## 8) Compatibility Note

- `GET /subjects/:subjectId/dashboard`가 존재하더라도 learning status의 primary frontend API는 `/subjects/:subjectId/learning-status`다.
- `GET /subjects/:subjectId/mastery`는 기존 subject mastery 호환 API로 유지할 수 있다.
