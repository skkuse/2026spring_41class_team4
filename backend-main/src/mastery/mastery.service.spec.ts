import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentEntity } from '../document/entities/document.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { DifficultyLevel } from '../quiz/enums/difficulty-level.enum';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizProblemAttemptEntity } from '../quiz-attempts/entities/quiz-problem-attempt.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { MasteryScore } from './entities/mastery-score.entity';
import { MasteryService } from './mastery.service';

type MockRepo<T> = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

describe('MasteryService', () => {
  let masteryScoreRepository: MockRepo<MasteryScore>;
  let quizAttemptRepository: MockRepo<QuizAttemptEntity>;
  let quizProblemAttemptRepository: MockRepo<QuizProblemAttemptEntity>;
  let quizProblemKeywordRepository: MockRepo<unknown>;
  let keywordRepository: MockRepo<Keyword>;
  let documentRepository: MockRepo<DocumentEntity>;
  let subjectRepository: MockRepo<Subject>;
  let service: MasteryService;

  beforeEach(() => {
    masteryScoreRepository = createMockRepo<MasteryScore>();
    quizAttemptRepository = createMockRepo<QuizAttemptEntity>();
    quizProblemAttemptRepository = createMockRepo<QuizProblemAttemptEntity>();
    quizProblemKeywordRepository = createMockRepo<unknown>();
    keywordRepository = createMockRepo<Keyword>();
    documentRepository = createMockRepo<DocumentEntity>();
    subjectRepository = createMockRepo<Subject>();
    service = new MasteryService(
      masteryScoreRepository as never,
      quizAttemptRepository as never,
      quizProblemAttemptRepository as never,
      quizProblemKeywordRepository as never,
      keywordRepository as never,
      documentRepository as never,
      subjectRepository as never,
    );
  });

  it('recalculates keyword mastery from persisted answered attempts', async () => {
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1' },
    ]);
    quizProblemAttemptRepository.createQueryBuilder.mockReturnValue(
      createAttemptQueryBuilder([
        createAttempt(DifficultyLevel.EASY, true, false),
        createAttempt(DifficultyLevel.HARD, false, true),
      ]),
    );
    masteryScoreRepository.findOne.mockResolvedValue(null);
    masteryScoreRepository.create.mockImplementation((value) => value);
    masteryScoreRepository.save.mockImplementation(async (value) => value);

    const updates = await service.updateMasteryForProblemAnswer({
      userId: 'user-1',
      quizProblemId: 'problem-1',
      answeredAt: new Date('2026-06-05T00:00:00.000Z'),
    });

    expect(masteryScoreRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        keywordId: 'keyword-1',
        attempts: 2,
        correctCount: 1,
        recentCorrectRate: 0.5,
        difficultyWeightedScore: 0.375,
        noHintBonus: 0.5,
        masteryScore: 0.475,
      }),
    );
    expect(updates).toEqual([{ keywordId: 'keyword-1', masteryScore: 0.475 }]);
  });

  it('uses all answered attempts returned by the query', async () => {
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1' },
    ]);
    quizProblemAttemptRepository.createQueryBuilder.mockReturnValue(
      createAttemptQueryBuilder([
        ...Array.from({ length: 11 }, () =>
          createAttempt(DifficultyLevel.MEDIUM, true, false),
        ),
        createAttempt(DifficultyLevel.MEDIUM, false, true),
      ]),
    );
    masteryScoreRepository.findOne.mockResolvedValue({
      id: 'mastery-1',
      userId: 'user-1',
      keywordId: 'keyword-1',
    });
    masteryScoreRepository.save.mockImplementation(async (value) => value);

    await service.updateMasteryForProblemAnswer({
      userId: 'user-1',
      quizProblemId: 'problem-1',
      answeredAt: new Date('2026-06-05T00:00:00.000Z'),
    });

    expect(
      quizProblemAttemptRepository.createQueryBuilder().take,
    ).not.toHaveBeenCalled();
    expect(masteryScoreRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 12,
        correctCount: 11,
        recentCorrectRate: 0.9167,
        difficultyWeightedScore: 0.9167,
        noHintBonus: 0.9167,
        masteryScore: 0.9167,
      }),
    );
  });

  it('derives subject mastery through documents, keywords, and mastery scores', async () => {
    subjectRepository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
    });
    documentRepository.find.mockResolvedValue([
      { id: 'document-1' },
      { id: 'document-2' },
    ]);
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1', name: 'Strong' },
      { id: 'keyword-2', name: 'Weak' },
      { id: 'keyword-3', name: 'Unattempted' },
    ]);
    masteryScoreRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1', masteryScore: '0.8000' },
      { keywordId: 'keyword-2', masteryScore: '0.3000' },
    ]);

    await expect(
      service.getSubjectMastery('user-1', 'subject-1'),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      overallMastery: 0.55,
      strongKeywords: [
        { keywordId: 'keyword-1', name: 'Strong', masteryScore: 0.8 },
      ],
      weakKeywords: [
        { keywordId: 'keyword-2', name: 'Weak', masteryScore: 0.3 },
      ],
    });
  });

  it('validates subject ownership before loading mastery data', async () => {
    subjectRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getSubjectMastery('user-1', 'subject-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns document coverage 0 when there are no keywords', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'document-1',
      ownerUserId: 'user-1',
    });
    keywordRepository.find.mockResolvedValue([]);

    await expect(
      service.calculateDocumentCoverage('user-1', 'document-1'),
    ).resolves.toBe(0);
    expect(quizProblemKeywordRepository.find).not.toHaveBeenCalled();
  });

  it('returns document coverage 0 when keywords exist but no quiz problem keyword mappings exist', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'document-1',
      ownerUserId: 'user-1',
    });
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1' },
      { id: 'keyword-2' },
    ]);
    quizProblemKeywordRepository.find.mockResolvedValue([]);

    await expect(
      service.calculateDocumentCoverage('user-1', 'document-1'),
    ).resolves.toBe(0);
  });

  it('counts distinct keyword IDs for document coverage', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'document-1',
      ownerUserId: 'user-1',
    });
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1' },
      { id: 'keyword-2' },
      { id: 'keyword-3' },
    ]);
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1' },
      { keywordId: 'keyword-1' },
      { keywordId: 'keyword-2' },
    ]);

    await expect(
      service.calculateDocumentCoverage('user-1', 'document-1'),
    ).resolves.toBe(0.6667);
  });

  it('aggregates subject coverage across all documents under the subject', async () => {
    subjectRepository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
    });
    documentRepository.find.mockResolvedValue([
      { id: 'document-1' },
      { id: 'document-2' },
    ]);
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1' },
      { id: 'keyword-2' },
      { id: 'keyword-3' },
    ]);
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-2' },
      { keywordId: 'keyword-3' },
    ]);

    await expect(
      service.calculateSubjectCoverage('user-1', 'subject-1'),
    ).resolves.toBe(0.6667);
  });

  it('returns subject learning status with mastery and coverage', async () => {
    subjectRepository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
    });
    documentRepository.find.mockResolvedValue([{ id: 'document-1' }]);
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1', name: 'Strong' },
      { id: 'keyword-2', name: 'Weak' },
    ]);
    masteryScoreRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1', masteryScore: '0.8000' },
      { keywordId: 'keyword-2', masteryScore: '0.3000' },
    ]);
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1' },
    ]);

    await expect(
      service.getSubjectLearningStatus('user-1', 'subject-1'),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      mastery: 0.55,
      coverage: 0.5,
      strongKeywords: [
        { keywordId: 'keyword-1', name: 'Strong', masteryScore: 0.8 },
      ],
      weakKeywords: [
        { keywordId: 'keyword-2', name: 'Weak', masteryScore: 0.3 },
      ],
    });
  });

  it('returns document learning status without dashboard fields', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'document-1',
      ownerUserId: 'user-1',
    });
    keywordRepository.find.mockResolvedValue([
      { id: 'keyword-1', name: 'Strong' },
      { id: 'keyword-2', name: 'Weak' },
    ]);
    masteryScoreRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1', masteryScore: '0.9000' },
      { keywordId: 'keyword-2', masteryScore: '0.2000' },
    ]);
    quizProblemKeywordRepository.find.mockResolvedValue([
      { keywordId: 'keyword-1' },
    ]);

    await expect(
      service.getDocumentLearningStatus('user-1', 'document-1'),
    ).resolves.toEqual({
      documentId: 'document-1',
      mastery: 0.55,
      coverage: 0.5,
      strongKeywords: [
        { keywordId: 'keyword-1', name: 'Strong', masteryScore: 0.9 },
      ],
      weakKeywords: [
        { keywordId: 'keyword-2', name: 'Weak', masteryScore: 0.2 },
      ],
    });
  });

  it('prevents access to another user document coverage', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'document-1',
      ownerUserId: 'user-2',
    });

    await expect(
      service.calculateDocumentCoverage('user-1', 'document-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(keywordRepository.find).not.toHaveBeenCalled();
  });

  it('prevents access to another user subject coverage', async () => {
    subjectRepository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-2',
    });

    await expect(
      service.calculateSubjectCoverage('user-1', 'subject-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(documentRepository.find).not.toHaveBeenCalled();
  });
});

function createMockRepo<T>(): MockRepo<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createAttemptQueryBuilder(attempts: QuizProblemAttemptEntity[]) {
  const builder = {
    innerJoinAndSelect: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    addOrderBy: jest.fn(() => builder),
    take: jest.fn(() => builder),
    getMany: jest.fn(async () => attempts),
  };
  return builder;
}

function createAttempt(
  difficulty: DifficultyLevel,
  isCorrect: boolean,
  usedHint: boolean,
): QuizProblemAttemptEntity {
  return {
    isCorrect,
    usedHint,
    quizProblem: {
      difficulty,
    },
  } as QuizProblemAttemptEntity;
}
