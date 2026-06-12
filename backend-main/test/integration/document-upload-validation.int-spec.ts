/**
 * Integration: document upload file validation.
 *
 * 실제 AppModule + 테스트 DB(sudocampus_test) + supertest로
 * POST /subjects/:subjectId/documents/upload 의 파일 검증 계약을 고정한다.
 * (2026-06-05 라이브 검증 매트릭스를 자동화한 것 — test/fixtures/README.md)
 *
 * 전제: 로컬 Postgres 기동 + java 런타임 (PDF 파서가 jar를 spawn,
 * docs/environment.md Runtime Prerequisites 참고).
 *
 * Run with: `npm run test:integration`
 */
import { INestApplication } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  createAndLoginTestUser,
  createTestingApp,
  TestUser,
  truncateAllTables,
} from './helpers';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');
const REAL_PDF_PATH = join(
  process.cwd(),
  'uploads/documents/8491aabe-671a-4f77-b559-bc23e1b6ac26.pdf',
);

describe('Document upload file validation (integration)', () => {
  let app: INestApplication;
  let user: TestUser;
  let subjectId: string;

  const uploadRequest = () =>
    request(app.getHttpServer())
      .post(`/subjects/${subjectId}/documents/upload`)
      .set('Authorization', `Bearer ${user.accessToken}`);

  const attachFixture = (fileName: string, contentType?: string) =>
    uploadRequest().attach('file', join(FIXTURES_DIR, fileName), {
      filename: fileName,
      ...(contentType ? { contentType } : {}),
    });

  beforeAll(async () => {
    app = await createTestingApp();
    user = await createAndLoginTestUser(app);
    const subjectResponse = await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name: 'Upload Validation Integration' })
      .expect(201);
    subjectId = subjectResponse.body.id;
  });

  afterAll(async () => {
    await truncateAllTables(app.get(DataSource));
    await app.close();
  });

  it('rejects text uploads (.txt/.md) with 400', async () => {
    await attachFixture('test_03.txt').expect(400);
    await attachFixture('test_10.md').expect(400);
  });

  it('rejects image uploads (.png/.jpeg) with 400', async () => {
    await attachFixture('test_04.png').expect(400);
    await attachFixture('test_05.jpeg').expect(400);
  });

  it('rejects zip-based Office formats (.docx/.pptx/.xlsx) and .zip with 400', async () => {
    await attachFixture('test_06.docx').expect(400);
    await attachFixture('test_02.pptx').expect(400);
    await attachFixture('test_11.xlsx').expect(400);
    await attachFixture('test_07.zip').expect(400);
  });

  it('rejects .hwp and .mp4 with 400', async () => {
    await attachFixture('test_08.hwp').expect(400);
    await attachFixture('test_09.mp4').expect(400);
  });

  it('rejects a 0-byte .pdf with 400', async () => {
    await attachFixture('test_01_void.pdf', 'application/pdf').expect(400);
  });

  it('rejects non-PDF content spoofed as application/pdf with 400 (magic-number check)', async () => {
    // 선언 mimetype은 application/pdf지만 내용은 텍스트/zip — 내용 기반으로 거부돼야 한다.
    await attachFixture('test_03.txt', 'application/pdf').expect(400);
    await attachFixture('test_07.zip', 'application/pdf').expect(400);
  });

  it('rejects a PDF over 50MB with 400', async () => {
    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(51 * 1024 * 1024),
    ]);
    const response = await uploadRequest()
      .attach('file', oversized, {
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(response.body.message).toContain('expected size is less than');
  });

  it('returns a 400 without persisting anything when a valid PDF is declared with a wrong mimetype (ISSUE-008)', async () => {
    if (!existsSync(REAL_PDF_PATH)) {
      throw new Error(`fixture missing: ${REAL_PDF_PATH}`);
    }
    const realPdf = readFileSync(REAL_PDF_PATH);
    const response = await uploadRequest()
      .attach('file', realPdf, {
        filename: 'renamed-real-pdf.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(response.body.message).toContain(
      'could not be processed as a PDF document',
    );

    // 고아 행이 남지 않아야 한다.
    const orphans: Array<{ count: string }> = await app
      .get(DataSource)
      .query(
        `SELECT COUNT(*)::text AS count FROM documents WHERE "originalFileName" = 'renamed-real-pdf.txt'`,
      );
    expect(orphans[0].count).toBe('0');
  });

  it('accepts a real PDF with 201 and parses page count', async () => {
    if (!existsSync(REAL_PDF_PATH)) {
      throw new Error(`fixture missing: ${REAL_PDF_PATH}`);
    }
    const response = await uploadRequest()
      .attach('file', REAL_PDF_PATH, {
        filename: 'lecture.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body.documentId).toBeDefined();
    expect(response.body.pageCount).toBeGreaterThan(0);
    expect(response.body.analysisStatus).toBe('UPLOADED');

    // 저장 파일/파서 출력까지 API 경로로 정리한다.
    await request(app.getHttpServer())
      .delete(`/documents/${response.body.documentId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
  });
});
