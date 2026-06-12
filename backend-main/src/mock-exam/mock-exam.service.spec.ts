import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizType } from '../quiz/enums/quiz-type.enum';
import { QuizAiGenerationService } from '../quiz/quiz-ai-generation.service';
import { QuizService } from '../quiz/quiz.service';
import { SubjectsService } from '../subjects/subjects.service';
import { MockExamProblem } from './entities/mock-exam-problem.entity';
import { MockExam } from './entities/mock-exam.entity';
import { MockExamService } from './mock-exam.service';

describe('MockExamService', () => {
  let service: MockExamService;

  const manager = { save: jest.fn() };
  const dataSource = {
    transaction: jest.fn(),
  };
  const subjectsService = { findOne: jest.fn() };
  const quizService = {
    prepareGeneratedProblemsForSaving: jest.fn(),
    persistGeneratedQuiz: jest.fn(),
  };
  const quizAiGenerationService = { generateLectureQuiz: jest.fn() };
  const documentRepository = { find: jest.fn() };
  const keywordRepository = { find: jest.fn() };
  const keywordChunkRepository = { find: jest.fn() };
  const masteryScoreRepository = { find: jest.fn() };
  const mockExamQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const mockExamRepository = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockExamQueryBuilder),
  };
  const mockExamProblemRepository = { create: jest.fn() };
  const quizAttemptRepository = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager.save.mockImplementation(async (entity) => entity);
    dataSource.transaction.mockImplementation(async (cb) => cb(manager));
    mockExamRepository.createQueryBuilder.mockReturnValue(mockExamQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockExamService,
        { provide: DataSource, useValue: dataSource },
        { provide: SubjectsService, useValue: subjectsService },
        { provide: QuizService, useValue: quizService },
        { provide: QuizAiGenerationService, useValue: quizAiGenerationService },
        { provide: getRepositoryToken(DocumentEntity), useValue: documentRepository },
        { provide: getRepositoryToken(Keyword), useValue: keywordRepository },
        { provide: getRepositoryToken(KeywordChunkEntity), useValue: keywordChunkRepository },
        { provide: getRepositoryToken(MasteryScore), useValue: masteryScoreRepository },
        { provide: getRepositoryToken(MockExam), useValue: mockExamRepository },
        { provide: getRepositoryToken(MockExamProblem), useValue: mockExamProblemRepository },
        { provide: getRepositoryToken(QuizAttemptEntity), useValue: quizAttemptRepository },
      ],
    }).compile();

    service = module.get<MockExamService>(MockExamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMockExam validation', () => {
    beforeEach(() => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1', name: 'Algorithms' });
    });

    it('rejects explicit documentIds that do not all belong to the subject/user', async () => {
      // two ids requested but only one resolves -> ownership/scope mismatch
      documentRepository.find.mockResolvedValue([
        { id: 'doc-1', analysisStatus: 'ANALYZED' },
      ]);

      await expect(
        service.createMockExam('user-1', 'subject-1', {
          quizProblemCount: 5,
          documentIds: ['doc-1', 'doc-2'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires every explicitly selected document to be ANALYZED', async () => {
      documentRepository.find.mockResolvedValue([
        { id: 'doc-1', analysisStatus: 'ANALYZED' },
        { id: 'doc-2', analysisStatus: 'PENDING' },
      ]);

      await expect(
        service.createMockExam('user-1', 'subject-1', {
          quizProblemCount: 5,
          documentIds: ['doc-1', 'doc-2'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the scope has no documents', async () => {
      documentRepository.find.mockResolvedValue([]);

      await expect(
        service.createMockExam('user-1', 'subject-1', { quizProblemCount: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when no keywords exist in the scope', async () => {
      documentRepository.find.mockResolvedValue([{ id: 'doc-1', analysisStatus: 'ANALYZED' }]);
      keywordRepository.find.mockResolvedValue([]);

      await expect(
        service.createMockExam('user-1', 'subject-1', { quizProblemCount: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects explicit keywordIds outside the scope', async () => {
      documentRepository.find.mockResolvedValue([{ id: 'doc-1', analysisStatus: 'ANALYZED' }]);
      keywordRepository.find.mockResolvedValue([
        { id: 'kw-1', name: 'Closures', description: null, importanceScore: 0.8, documentId: 'doc-1' },
      ]);
      masteryScoreRepository.find.mockResolvedValue([]);

      await expect(
        service.createMockExam('user-1', 'subject-1', {
          quizProblemCount: 5,
          keywordIds: ['kw-not-in-scope'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createMockExam happy path', () => {
    it('builds a plan, persists the quiz + mock exam, and returns identifiers', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1', name: 'Algorithms' });
      documentRepository.find.mockResolvedValue([{ id: 'doc-1', analysisStatus: 'ANALYZED' }]);
      keywordRepository.find.mockResolvedValue([
        { id: 'kw-1', name: 'Closures', description: null, importanceScore: 0.8, documentId: 'doc-1' },
      ]);
      masteryScoreRepository.find.mockResolvedValue([]);
      keywordChunkRepository.find.mockResolvedValue([
        {
          keywordId: 'kw-1',
          evidenceText: 'evidence',
          relevanceScore: 0.9,
          documentChunk: {
            id: 'chunk-1',
            documentId: 'doc-1',
            pageNumber: 1,
            heading: 'Intro',
            content: 'body',
          },
        },
      ]);
      quizAiGenerationService.generateLectureQuiz.mockResolvedValue([{ raw: 'ai' }]);
      quizService.prepareGeneratedProblemsForSaving.mockReturnValue([{ q: 1 }, { q: 2 }]);
      quizService.persistGeneratedQuiz.mockResolvedValue({
        quiz: { id: 'quiz-1' },
        quizProblemIds: ['qp-1', 'qp-2'],
      });
      mockExamRepository.create.mockReturnValue({ id: 'me-1' });
      mockExamProblemRepository.create.mockImplementation((row) => row);

      const result = await service.createMockExam('user-1', 'subject-1', {
        quizProblemCount: 2,
      });

      expect(result).toEqual({
        mockExamId: 'me-1',
        quizId: 'quiz-1',
        quizType: QuizType.MOCK_EXAM,
        quizProblemCount: 2,
      });

      // Spec item 3: mastery lookup scoped to the user, never the subject.
      expect(masteryScoreRepository.find.mock.calls[0][0].where.userId).toBe('user-1');

      // The plan handed to AI generation carries the resolved document/subject context.
      const planArg = quizAiGenerationService.generateLectureQuiz.mock.calls[0][0];
      expect(planArg.documentId).toBe('doc-1');
      expect(planArg.subjectId).toBe('subject-1');
      expect(planArg.targets.map((target: { keywordId: string }) => target.keywordId)).toEqual([
        'kw-1',
      ]);

      // Persisted as a MOCK_EXAM quiz, with one mock-exam-problem row per persisted problem.
      expect(quizService.persistGeneratedQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ quizType: QuizType.MOCK_EXAM, documentId: null }),
        manager,
      );
      expect(mockExamProblemRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('listMockExams', () => {
    it('returns an empty list when the user has no mock exams', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1', name: 'Algorithms' });
      mockExamQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.listMockExams('user-1', 'subject-1');

      expect(result).toEqual([]);
      expect(subjectsService.findOne).toHaveBeenCalledWith('user-1', 'subject-1');
      expect(quizAttemptRepository.find).not.toHaveBeenCalled();
    });

    it('maps mock exams with their latest attempt summary', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1', name: 'Algorithms' });
      mockExamQueryBuilder.getMany.mockResolvedValue([
        {
          id: 'me-1',
          quizId: 'quiz-1',
          subjectId: 'subject-1',
          quizProblemCount: 2,
          targetWeakKeywords: true,
          generatedFromMastery: true,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          quiz: { title: 'Algorithms Mock Exam' },
        },
      ]);
      quizAttemptRepository.find.mockResolvedValue([
        {
          id: 'att-1',
          quizId: 'quiz-1',
          status: 'SUBMITTED',
          startedAt: new Date('2026-01-03T00:00:00.000Z'),
          submittedAt: new Date('2026-01-03T01:00:00.000Z'),
          totalQuizProblems: 2,
          correctCount: 1,
          score: '80.5',
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        },
      ]);

      const [item] = await service.listMockExams('user-1', 'subject-1');

      expect(item.mockExamId).toBe('me-1');
      expect(item.title).toBe('Algorithms Mock Exam');
      expect(item.createdAt).toBe('2026-01-02T00:00:00.000Z');
      expect(item.latestAttempt).toMatchObject({
        attemptId: 'att-1',
        status: 'SUBMITTED',
        score: 80.5,
        correctCount: 1,
      });
    });
  });
});
