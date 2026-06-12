# SudoCampus Mastery API Interface

- 작성일: 2026-06-05
- 기준 코드:
  - `src/mastery/mastery.controller.ts`
  - `src/mastery/mastery.service.ts`
  - `src/mastery/dto/subject-mastery-response.dto.ts`
  - `src/mastery/entities/mastery-score.entity.ts`
  - `src/quiz-attempts/quiz-attempts.service.ts`

이 문서는 현재 구현된 Mastery 모듈과 퀴즈 답안 제출 후 mastery 갱신 계약을 FE 공유용으로 정리한다.

## 1) 공통 규칙

- 모든 Mastery API는 인증이 필요하다.
- Header: `Authorization: Bearer <accessToken>`
- Path param의 `subjectId`는 UUID v4 형식이어야 한다.
- 사용자는 본인 소유 subject의 mastery만 조회할 수 있다.
- `mastery_scores`는 `user_id + keyword_id` 기준으로 저장된다.
- subject 단위 mastery는 `subjects -> documents -> keywords -> mastery_scores` 조인으로 파생한다.
- `mastery_scores`에 `subject_id`는 없다.

## 2) API 목록

| Method | Endpoint | Status | Description |
| --- | --- | --- | --- |
| `GET` | `/subjects/:subjectId/mastery` | LIVE | 과목별 mastery 요약 조회 |

## 3) TypeScript Interface

```ts
export interface SubjectMasteryKeyword {
  keywordId: string;
  name: string;
  masteryScore: number; // 0.0 ~ 1.0
}

export interface SubjectMasteryResponse {
  subjectId: string;
  overallMastery: number; // attempted keyword mastery 평균, 0.0 ~ 1.0
  strongKeywords: SubjectMasteryKeyword[]; // masteryScore >= 0.7
  weakKeywords: SubjectMasteryKeyword[]; // masteryScore < 0.4
}

export interface UpdatedMasteryItem {
  keywordId: string;
  masteryScore: number; // 0.0 ~ 1.0
}
```

## 4) GET `/subjects/:subjectId/mastery`

과목에 속한 문서의 키워드 중, 현재 사용자가 시도한 키워드의 mastery 현황을 반환한다.

### Request

- Body 없음
- Path param
  - `subjectId: string`

### Response

```json
{
  "subjectId": "9d8d4f6f-5947-41cb-9c6d-536e9388339e",
  "overallMastery": 0.55,
  "strongKeywords": [
    {
      "keywordId": "77822867-a290-4243-8270-8f092db8a6e1",
      "name": "Software Engineering",
      "masteryScore": 0.8
    }
  ],
  "weakKeywords": [
    {
      "keywordId": "b8ac193a-d4ad-4146-a6e3-e5c613b80612",
      "name": "Waterfall Model",
      "masteryScore": 0.3
    }
  ]
}
```

### Empty state

문서, 키워드, 또는 시도된 mastery row가 없으면 빈 배열과 `overallMastery: 0`을 반환한다.

```json
{
  "subjectId": "9d8d4f6f-5947-41cb-9c6d-536e9388339e",
  "overallMastery": 0,
  "strongKeywords": [],
  "weakKeywords": []
}
```

### Classification

- `overallMastery`: 시도된 키워드들의 `masteryScore` 평균
- `strongKeywords`: `masteryScore >= 0.7`
- `weakKeywords`: `masteryScore < 0.4`
- MVP에서는 미시도 키워드를 `strongKeywords`, `weakKeywords`에서 제외한다.

### Error

| Status | Case |
| --- | --- |
| `400` | `subjectId`가 UUID v4가 아님 |
| `401` | 인증 토큰 없음 또는 만료 |
| `404` | subject가 없거나 현재 사용자 소유가 아님 |

## 5) Mastery 갱신 연동

개별 답안 제출 API는 기존 응답 shape를 유지하면서 `updatedMastery`를 반환한다.

```ts
export interface SubmitAnswerResponse {
  quizProblemId: string;
  isCorrect: boolean;
  explanation?: string;
  feedback?: string;
  updatedMastery: UpdatedMasteryItem[];
  selectedChoiceIds?: string[]; // MULTIPLE_CHOICE인 경우 포함
}
```

- `POST /attempts/:attemptId/answers` 성공 후 해당 문제의 `quiz_problem_keywords`에 연결된 keyword mastery를 재계산한다.
- `POST /attempts/:attemptId/submit` 최종 제출 시 미응답/null correctness 문제를 오답으로 확정한 뒤 mastery를 재계산한다.
- 최종 제출 응답에는 기존 호환성을 위해 `updatedMastery`를 추가하지 않는다.

## 6) Mastery 계산 정책

```ts
masteryScore =
  0.7 * recentCorrectRate
+ 0.2 * difficultyWeightedScore
+ 0.1 * noHintBonus
```

- 계산 대상: 같은 `user_id + keyword_id`의 모든 `quiz_problem_attempts`
- 포함 조건: `is_correct IS NOT NULL`
- 제외 조건: 진행 중인 미응답/미채점 문제(`is_correct = null`)
- 최종 제출 시 미응답 문제는 `is_correct = false`로 확정되어 이후 계산에 포함된다.

### Sub-scores

- `recentCorrectRate`: `correct answered attempts / answered attempts`
- `difficultyWeightedScore`: `sum(isCorrect ? difficultyWeight : 0) / sum(difficultyWeight)`
- `noHintBonus`: `answered attempts without hint / answered attempts`

### Difficulty weights

```ts
EASY = 0.6
MEDIUM = 0.8
HARD = 1.0
```

- difficulty weight는 weighted average 계산에만 사용한다.
- `difficultyWeightedScore`와 `masteryScore`는 항상 `0.0 ~ 1.0` 범위로 clamp된다.
- mastery 계산은 `quiz_problems.difficulty`에 저장된 서버 계산 최종 난이도만 사용한다.
- AI가 제공한 `modelPredictedDifficulty`, `bloomLevel`, `dokLevel`은 mastery 계산에 사용하지 않는다.
