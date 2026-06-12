/**
 * Integration: keyword document-scoping.
 *
 * `document/06-implementation-status.md` 항목 4·8·9가 권고한 통합 테스트 —
 * keywords는 document 소속이며, 동명 키워드는 document 간 격리되고,
 * subject 키워드는 documents 조인 집계여야 한다.
 *
 * 실제 AppModule + 테스트 DB 위에서 documents/keywords 행을 직접 시딩해
 * AI 호출 없이 검증한다. (upload -> analyze 전체 경로는 OpenAI 의존이라
 * 마지막 todo로 유지.)
 *
 * Run with: `npm run test:integration`
 */
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DocumentAnalysisAiService } from '../../src/document/document-analysis-ai.service';
import { DocumentEntity } from '../../src/document/entities/document.entity';
import { Keyword } from '../../src/keywords/entities/keyword.entity';
import {
  createAndLoginTestUser,
  createTestingApp,
  TestUser,
  truncateAllTables,
} from './helpers';

describe('Keyword document-scoping (integration)', () => {
  let app: INestApplication;
  let user: TestUser;
  let subjectId: string;
  let documentAId: string;
  let documentBId: string;
  let keywordAId: string;
  let keywordBId: string;

  const authed = (req: request.Test) =>
    req.set('Authorization', `Bearer ${user.accessToken}`);

  beforeAll(async () => {
    app = await createTestingApp();
    user = await createAndLoginTestUser(app);

    const subjectResponse = await authed(
      request(app.getHttpServer()).post('/subjects'),
    )
      .send({ name: 'Keyword Isolation Integration' })
      .expect(201);
    subjectId = subjectResponse.body.id;

    // 같은 subject 아래 두 ANALYZED 문서를 시딩하고,
    // 양쪽에 같은 이름('Recursion')의 키워드를 만든다.
    const dataSource = app.get(DataSource);
    const documentRepository = dataSource.getRepository(DocumentEntity);
    const keywordRepository = dataSource.getRepository(Keyword);

    documentAId = randomUUID();
    documentBId = randomUUID();
    await documentRepository.save([
      documentRepository.create({
        id: documentAId,
        ownerUserId: user.userId,
        subjectId,
        title: 'Lecture A',
        analysisStatus: 'ANALYZED',
      }),
      documentRepository.create({
        id: documentBId,
        ownerUserId: user.userId,
        subjectId,
        title: 'Lecture B',
        analysisStatus: 'ANALYZED',
      }),
    ]);

    const savedKeywords = await keywordRepository.save([
      keywordRepository.create({
        documentId: documentAId,
        name: 'Recursion',
        importanceScore: 0.9,
      }),
      keywordRepository.create({
        documentId: documentBId,
        name: 'Recursion',
        importanceScore: 0.7,
      }),
    ]);
    keywordAId = savedKeywords[0].id;
    keywordBId = savedKeywords[1].id;
  });

  afterAll(async () => {
    await truncateAllTables(app.get(DataSource));
    await app.close();
  });

  // Spec item 9: 동명 키워드는 document 간 별개 행으로 격리된다.
  it('keeps same-name keywords isolated between two documents of one subject', async () => {
    const responseA = await authed(
      request(app.getHttpServer()).get(`/documents/${documentAId}/keywords`),
    ).expect(200);
    const responseB = await authed(
      request(app.getHttpServer()).get(`/documents/${documentBId}/keywords`),
    ).expect(200);

    const keywordsA = responseA.body.keywords ?? responseA.body;
    const keywordsB = responseB.body.keywords ?? responseB.body;

    expect(keywordsA).toHaveLength(1);
    expect(keywordsB).toHaveLength(1);
    expect(keywordsA[0].name).toBe('Recursion');
    expect(keywordsB[0].name).toBe('Recursion');
    expect(keywordsA[0].documentId).toBe(documentAId);
    expect(keywordsB[0].documentId).toBe(documentBId);
    expect(keywordsA[0].id).not.toBe(keywordsB[0].id);
  });

  // Spec item 8: subject 키워드는 documents 조인 집계 — 동명 2행이 모두 보이고
  // 각 행이 자기 document 컨텍스트(documentId)를 가진다.
  it('aggregates subject keywords by joining documents -> keywords', async () => {
    const response = await authed(
      request(app.getHttpServer()).get(`/subjects/${subjectId}/keywords`),
    ).expect(200);

    const keywords = response.body.keywords ?? response.body;
    const recursionRows = keywords.filter(
      (keyword: { name: string }) => keyword.name === 'Recursion',
    );
    expect(recursionRows).toHaveLength(2);
    expect(
      recursionRows.map((keyword: { documentId: string }) => keyword.documentId).sort(),
    ).toEqual([documentAId, documentBId].sort());
  });

  // Spec item 4: quiz 생성 시 선택한 keywordIds는 대상 document 소속이어야 한다.
  it('rejects quiz creation when a keywordId belongs to a different document', async () => {
    const response = await authed(
      request(app.getHttpServer()).post(`/documents/${documentAId}/quiz`),
    )
      .send({ quizProblemCount: 2, keywordIds: [keywordBId] })
      .expect(400);
    expect(response.body.message).toContain(
      'must belong to the target document',
    );
  });

  it('rejects quiz creation against a document owned by someone else', async () => {
    const stranger = await createAndLoginTestUser(app);
    await request(app.getHttpServer())
      .post(`/documents/${documentAId}/quiz`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ quizProblemCount: 2, keywordIds: [keywordAId] })
      .expect(403);
  });

});

/**
 * Spec item 9: upload -> analyze -> keyword 추출 임계 경로.
 * OpenAI 경계만 overrideProvider로 대체하고(canned 분석 결과),
 * 업로드(java 파서 포함)·chunk 생성·keyword upsert·조회는 전부 실물로 돈다.
 */
describe('Upload -> analyze critical path (AI boundary mocked)', () => {
  let app: INestApplication;
  let user: TestUser;
  let subjectId: string;
  let analyzedDocumentId: string;

  const cannedAnalysis = {
    overallSummary: '## 강의 요약\n\n핵심은 재귀다.',
    keywords: [
      {
        name: 'Recursion(재귀)',
        description: '자기 자신을 호출하는 함수 구조',
        importanceScore: 0.95,
        isLearningObjectiveCore: true,
        appearsMultipleTimes: true,
        isPrerequisiteForOtherConcepts: true,
        isUsedInAssessment: false,
      },
    ],
  };

  beforeAll(async () => {
    app = await createTestingApp((builder) =>
      builder.overrideProvider(DocumentAnalysisAiService).useValue({
        analyzeDocument: jest.fn().mockResolvedValue(cannedAnalysis),
      }),
    );
    user = await createAndLoginTestUser(app);
    const subjectResponse = await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name: 'Analyze Critical Path' })
      .expect(201);
    subjectId = subjectResponse.body.id;
  });

  afterAll(async () => {
    // 업로드 산출물(저장 파일/파서 출력) 정리 후 테이블 초기화
    if (analyzedDocumentId) {
      await request(app.getHttpServer())
        .delete(`/documents/${analyzedDocumentId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);
    }
    await truncateAllTables(app.get(DataSource));
    await app.close();
  });

  it('runs upload -> analyze and returns only the analyzed document\'s keywords', async () => {
    // 1) 실제 PDF 업로드 (java 파서가 chunk까지 생성)
    const uploadResponse = await request(app.getHttpServer())
      .post(`/subjects/${subjectId}/documents/upload`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach(
        'file',
        join(
          process.cwd(),
          'uploads/documents/8491aabe-671a-4f77-b559-bc23e1b6ac26.pdf',
        ),
        { filename: 'lecture.pdf', contentType: 'application/pdf' },
      )
      .expect(201);
    analyzedDocumentId = uploadResponse.body.documentId;

    // 2) 다른 문서에 동명 키워드를 시딩해 "격리" 단언을 의미 있게 만든다.
    const dataSource = app.get(DataSource);
    const otherDocumentId = randomUUID();
    await dataSource.getRepository(DocumentEntity).save(
      dataSource.getRepository(DocumentEntity).create({
        id: otherDocumentId,
        ownerUserId: user.userId,
        subjectId,
        title: 'Other Lecture',
        analysisStatus: 'ANALYZED',
      }),
    );
    await dataSource.getRepository(Keyword).save(
      dataSource.getRepository(Keyword).create({
        documentId: otherDocumentId,
        name: 'Recursion(재귀)',
        importanceScore: 0.5,
      }),
    );

    // 3) 분석 실행 (AI 경계는 canned 응답)
    const analyzeResponse = await request(app.getHttpServer())
      .post(`/documents/${analyzedDocumentId}/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect([200, 201]).toContain(analyzeResponse.status);

    // 4) 분석된 문서의 키워드만 반환 — 타 문서의 동명 키워드가 섞이지 않는다.
    const keywordsResponse = await request(app.getHttpServer())
      .get(`/documents/${analyzedDocumentId}/keywords`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const keywords = keywordsResponse.body.keywords ?? keywordsResponse.body;

    expect(keywords).toHaveLength(1);
    expect(keywords[0].name).toBe('Recursion(재귀)');
    expect(keywords[0].documentId).toBe(analyzedDocumentId);

    // 5) 문서 상태가 ANALYZED로 전이됐는지 확인
    const statusResponse = await request(app.getHttpServer())
      .get(`/documents/${analyzedDocumentId}/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(statusResponse.body.analysisStatus).toBe('ANALYZED');
  });
});
