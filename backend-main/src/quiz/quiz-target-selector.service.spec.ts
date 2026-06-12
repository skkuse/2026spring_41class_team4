import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizTargetSelectorService } from './quiz-target-selector.service';

/**
 * Backfill sample (green): QuizTargetSelectorService was previously untested.
 *
 * Besides covering the validation paths, these tests lock in two design rules
 * from `document/06-implementation-status.md`:
 *   - Item 4/9: selected keywordIds MUST belong to the target document.
 *   - Item 3:   mastery is queried by (user_id, keyword_id) only.
 * See ../../test/README.md for the spec-item -> test mapping.
 */
describe('QuizTargetSelectorService', () => {
  let service: QuizTargetSelectorService;

  const documentRepository = { findOne: jest.fn() };
  const keywordRepository = { find: jest.fn() };
  const masteryScoreRepository = { find: jest.fn() };
  const keywordChunkRepository = { find: jest.fn() };
  const documentChunkRepository = { find: jest.fn() };

  const analyzedDocument = {
    id: 'doc-1',
    ownerUserId: 'user-1',
    subjectId: 'subj-1',
    analysisStatus: 'ANALYZED',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizTargetSelectorService,
        { provide: getRepositoryToken(DocumentEntity), useValue: documentRepository },
        { provide: getRepositoryToken(Keyword), useValue: keywordRepository },
        { provide: getRepositoryToken(MasteryScore), useValue: masteryScoreRepository },
        { provide: getRepositoryToken(KeywordChunkEntity), useValue: keywordChunkRepository },
        { provide: getRepositoryToken(DocumentChunkEntity), useValue: documentChunkRepository },
      ],
    }).compile();

    service = module.get<QuizTargetSelectorService>(QuizTargetSelectorService);
  });

  const baseInput = {
    userId: 'user-1',
    documentId: 'doc-1',
    quizProblemCount: 2,
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a non-positive quizProblemCount', async () => {
    await expect(
      service.selectLectureQuizTargets({ ...baseInput, quizProblemCount: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(documentRepository.findOne).not.toHaveBeenCalled();
  });

  it('throws not found when the document does not exist', async () => {
    documentRepository.findOne.mockResolvedValue(null);
    await expect(
      service.selectLectureQuizTargets(baseInput),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids selecting targets on a document owned by another user', async () => {
    documentRepository.findOne.mockResolvedValue({
      ...analyzedDocument,
      ownerUserId: 'someone-else',
    });
    await expect(
      service.selectLectureQuizTargets(baseInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the document to be ANALYZED', async () => {
    documentRepository.findOne.mockResolvedValue({
      ...analyzedDocument,
      analysisStatus: 'PENDING',
    });
    await expect(
      service.selectLectureQuizTargets(baseInput),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Spec item 4/9: keyword ownership is document-scoped.
  it('rejects keywordIds that do not belong to the target document', async () => {
    documentRepository.findOne.mockResolvedValue(analyzedDocument);
    keywordRepository.find.mockResolvedValue([
      { id: 'kw-1', name: 'Closures', description: null, importanceScore: 0.8, documentId: 'doc-1' },
    ]);

    await expect(
      service.selectLectureQuizTargets({
        ...baseInput,
        keywordIds: ['kw-from-another-document'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // It must never reach the mastery lookup for an invalid ownership request.
    expect(masteryScoreRepository.find).not.toHaveBeenCalled();
  });

  it('produces a target plan and queries mastery by (userId, keywordId) only', async () => {
    documentRepository.findOne.mockResolvedValue(analyzedDocument);
    keywordRepository.find.mockResolvedValue([
      { id: 'kw-1', name: 'Closures', description: null, importanceScore: 0.8, documentId: 'doc-1' },
    ]);
    masteryScoreRepository.find.mockResolvedValue([]);
    keywordChunkRepository.find.mockResolvedValue([
      {
        keywordId: 'kw-1',
        relevanceScore: 0.9,
        evidenceText: 'evidence',
        documentChunk: { id: 'chunk-1', pageNumber: 1, heading: 'Intro', content: 'body' },
      },
    ]);
    documentChunkRepository.find.mockResolvedValue([
      { id: 'chunk-1', pageNumber: 1, heading: 'Intro', content: 'body', displayOrder: 0 },
    ]);

    const plan = await service.selectLectureQuizTargets(baseInput);

    expect(plan.documentId).toBe('doc-1');
    expect(plan.subjectId).toBe('subj-1');
    expect(plan.userId).toBe('user-1');
    expect(plan.quizProblemCount).toBe(2);
    expect(plan.targets.map((target) => target.keywordId)).toEqual(['kw-1']);
    expect(plan.sourceChunks.map((chunk) => chunk.chunkId)).toContain('chunk-1');

    // Spec item 3: mastery scoped strictly to user + keyword, never subject.
    const masteryWhere = masteryScoreRepository.find.mock.calls[0][0].where;
    expect(masteryWhere.userId).toBe('user-1');
    expect(masteryWhere.keywordId.type).toBe('in');
    expect(masteryWhere.keywordId.value).toContain('kw-1');
    expect(masteryWhere).not.toHaveProperty('subjectId');
  });
});
