# 🚀 PDF AI Tutor - Process 2 (OpenAI 연계 실행 가이드)

## 목적

현재 구현된 `PDF 업로드 -> OpenDataLoader 변환(json, md)` 흐름을 기반으로,  
**페이지별 요약 생성 + 페이지별 퀴즈 생성**까지 실제 서비스로 연결한다.

---

## 전체 실행 순서 (체크리스트)

- [x] Step 1. 출력 데이터 구조 확정
- [x] Step 2. 페이지 추출 로직 구현
- [x] Step 3. OpenAI 클라이언트 연동
- [x] Step 4. 1페이지 요약 API 검증
- [x] Step 5. 1페이지 퀴즈 API 검증
- [x] Step 6. 전체 페이지 배치 처리
- [x] Step 7. 결과 저장 구조 연결
- [ ] Step 8. 조회 API 정리
- [ ] Step 9. 에러/재시도/비용 관리
- [ ] Step 10. 테스트 및 운영 체크

---

## Step 1. 출력 데이터 구조 확정

요구사항:

- 페이지 단위 표준 응답 구조를 먼저 고정
- 이후 모든 서비스/DB/API가 같은 구조를 사용

권장 구조:

```ts
type PageContent = {
  pageNumber: number;
  text: string;
  markdown?: string;
  imagePaths?: string[];
};

type PageSummary = {
  pageNumber: number;
  summary: string;
  keyPoints: string[];
};

type PageQuiz = {
  pageNumber: number;
  questions: Array<{
    type: 'multiple_choice' | 'short_answer';
    question: string;
    choices?: string[];
    answer: string;
    explanation: string;
  }>;
};
```

완료 기준:

- 팀 내에서 위 구조를 최종 합의
- Controller 응답 DTO 초안 작성 완료

---

## Step 2. 페이지 추출 로직 구현

요구사항:

- `pdf-parser.service.ts` 결과(`jsonFiles`, `markdownFiles`)에서
- 페이지 번호 기반으로 `PageContent[]` 생성

실행 항목:

- JSON 파일 포맷 파악
- 텍스트 누락 시 markdown fallback 처리
- 이미지 파일 경로가 있으면 페이지별로 매핑

주의:

- JSON/MD 파일명 규칙이 변할 수 있으므로 파일명 하드코딩 최소화
- `pageNumber` 정렬 보장

완료 기준:

- 샘플 PDF 1개에서 `PageContent[]` 정상 출력
- 페이지 수/순서/텍스트 누락 여부 확인

---

## Step 3. OpenAI 클라이언트 연동

요구사항:

- OpenAI API 키 환경변수 등록
- LLM 호출 전용 서비스(`openai.service.ts` 또는 `llm.service.ts`) 분리

실행 항목:

- `OPENAI_API_KEY` 로딩 확인
- 타임아웃, 기본 모델, temperature 등 공통 옵션 정의
- JSON 응답 강제 전략(스키마 또는 엄격한 포맷 지시) 적용

완료 기준:

- 테스트용 고정 문장 입력 시 JSON 응답 파싱 성공

---

## Step 4. 1페이지 요약 API 검증

요구사항:

- 먼저 1페이지만 요약 생성해서 품질/응답 포맷 검증

권장 API:

- `POST /documents/:documentId/pages/:pageNumber/summary`

프롬프트 원칙:

- 출력 언어(한국어) 명시
- 길이 제한(예: 3~5문장)
- 핵심 포인트 배열 필수

완료 기준:

- 요약 결과가 항상 JSON 형태로 반환
- 응답 시간/비용 대략치 기록

---

## Step 5. 1페이지 퀴즈 API 검증

요구사항:

- 1페이지 기준으로 퀴즈 생성 품질 확인

권장 API:

- `POST /documents/:documentId/pages/:pageNumber/quiz`

입력 파라미터 예시:

- `count`: 문항 수 (기본 3)
- `difficulty`: easy | medium | hard
- `types`: 객관식/주관식 비율

완료 기준:

- 문제/정답/해설 모두 누락 없이 생성
- 답이 페이지 텍스트 근거와 충돌하지 않는지 확인

---

## Step 6. 전체 페이지 배치 처리

요구사항:

- 페이지별 요약/퀴즈를 전체 문서에 대해 수행

권장 API:

- `POST /documents/:documentId/generate`

요청 예시:

```json
{
  "target": "both",
  "pages": [1, 2, 3],
  "quizCountPerPage": 3
}
```

실행 전략:

- 동시성 제한(예: 2~4개) 적용
- 페이지 단위 실패 시 전체 중단 대신 부분 실패 기록

완료 기준:

- 다페이지 문서에서 안정적으로 완료
- 실패 페이지 재실행 가능

---

## Step 7. 결과 저장 구조 연결

요구사항:

- 생성 결과를 재조회 가능하도록 저장

권장 저장 단위:

- `Document`
- `Page`
- `PageSummary`
- `PageQuiz`

완료 기준:

- 생성 이후 재호출 없이 조회 가능
- 동일 페이지 재생성 정책(덮어쓰기/버전 관리) 결정

---

## Step 8. 조회 API 정리

권장 API:

- `GET /documents/:documentId/pages/:pageNumber`
- `GET /documents/:documentId/results`

반환 내용:

- 페이지 원문(또는 일부)
- 요약
- 퀴즈
- 생성 상태(`pending`, `completed`, `failed`)

완료 기준:

- 프론트에서 페이지 단위 학습 화면 구성 가능

---

## Step 9. 에러/재시도/비용 관리

요구사항:

- 운영 시 가장 먼저 문제가 나는 구간(네트워크/토큰 초과/속도 제한) 방어

실행 항목:

- 재시도(backoff) 정책
- 긴 페이지 chunking 후 요약-병합
- 요청/응답 토큰 사용량 로깅
- 문서당 비용 상한 설정(옵션)

완료 기준:

- 실패 원인 로그만 보고 복구 가능
- 비용 급증 상황 사전 감지 가능

---

## Step 10. 테스트 및 운영 체크

테스트 항목:

- 단위 테스트: 페이지 추출, JSON 파싱
- 통합 테스트: 업로드 -> 생성 -> 조회
- 품질 테스트: 요약 정확도, 퀴즈 정답 타당성

운영 체크:

- API timeout
- 동시 요청 시 큐잉/제한
- 임시 파일 정리 정책

완료 기준:

- 최소 3개 샘플 PDF에서 end-to-end 성공

---

## 구현 우선순위 (MVP)

1. 업로드/파싱 결과에서 페이지 추출 안정화
2. 1페이지 요약 성공
3. 1페이지 퀴즈 성공
4. 전체 페이지 배치 처리
5. 저장/조회 API 연결

---

## 이번 스프린트 권장 작업 분할

- 백엔드 1: 페이지 추출 + DTO 정리
- 백엔드 2: OpenAI 서비스 + 요약/퀴즈 프롬프트
- 백엔드 3: 배치 처리 + 에러/재시도
- 공통: 응답 스키마/테스트 케이스 확정

---

## 최종 목표 체크

- [ ] PDF 업로드 후 페이지별 콘텐츠 확보
- [ ] 페이지별 요약 생성 완료
- [ ] 페이지별 퀴즈 생성 완료
- [ ] 결과 저장 및 조회 가능
- [ ] 실패 복구/재시도/비용 관리 가능
