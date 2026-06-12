import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { GeneratedQuizProblemDto } from './dto/generated-quiz-problem.dto';
import { DifficultyLevel } from './enums/difficulty-level.enum';
import { QuizProblemType } from './enums/quiz-problem-type.enum';
import { QuizType } from './enums/quiz-type.enum';
import { QuizEntity } from './entities/quiz.entity';
import { QuizProblemChoiceEntity } from './entities/quiz-problem-choice.entity';
import { QuizProblemEntity } from './entities/quiz-problem.entity';
import { QuizProblemKeyword } from './entities/quiz-problem-keyword.entity';
import { QuizAiGenerationService } from './quiz-ai-generation.service';
import { QuizTargetSelectorService } from './quiz-target-selector.service';
import { QuizService } from './quiz.service';

/**
 * Unit tests for QuizService.
 *
 * The companion MockExamService spec mocks `prepareGeneratedProblemsForSaving`
 * and `persistGeneratedQuiz`; here we exercise their *real* implementations
 * (problem normalization / validation / difficulty-distribution selection and
 * the transactional save), plus the orchestration and ownership-guard paths.
 */
describe('QuizService', () => {
  let service: QuizService;

  const manager = {
    save: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };
  const quizTargetSelectorService = { selectLectureQuizTargets: jest.fn() };
  const quizAiGenerationService = { generateLectureQuiz: jest.fn() };
  const documentRepository = { findOne: jest.fn() };
  const keywordRepository = { find: jest.fn() };
  const quizRepository = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const quizAttemptRepository = { find: jest.fn() };
  const quizProblemRepository = { create: jest.fn() };
  const quizProblemChoiceRepository = { create: jest.fn() };
  const quizProblemKeywordRepository = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Echo back the persisted entity, attaching a deterministic id.
    let autoId = 0;
    manager.save.mockImplementation(async (entity) => {
      if (Array.isArray(entity)) {
        return entity;
      }
      autoId += 1;
      return { id: entity?.id ?? `saved-${autoId}`, ...entity };
    });
    manager.update.mockResolvedValue(undefined);
    dataSource.transaction.mockImplementation(async (cb) => cb(manager));
    // create() simply returns its plain payload for assertion convenience.
    quizRepository.create.mockImplementation((row) => ({ ...row }));
    quizProblemRepository.create.mockImplementation((row) => ({ ...row }));
    quizProblemChoiceRepository.create.mockImplementation((row) => ({ ...row }));
    quizProblemKeywordRepository.create.mockImplementation((row) => ({ ...row }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: DataSource, useValue: dataSource },
        { provide: QuizTargetSelectorService, useValue: quizTargetSelectorService },
        { provide: QuizAiGenerationService, useValue: quizAiGenerationService },
        { provide: getRepositoryToken(DocumentEntity), useValue: documentRepository },
        { provide: getRepositoryToken(Keyword), useValue: keywordRepository },
        { provide: getRepositoryToken(QuizEntity), useValue: quizRepository },
        { provide: getRepositoryToken(QuizAttemptEntity), useValue: quizAttemptRepository },
        { provide: getRepositoryToken(QuizProblemEntity), useValue: quizProblemRepository },
        { provide: getRepositoryToken(QuizProblemChoiceEntity), useValue: quizProblemChoiceRepository },
        { provide: getRepositoryToken(QuizProblemKeyword), useValue: quizProblemKeywordRepository },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  // A minimal valid generated problem; tests override fields as needed.
  const makeProblem = (
    overrides: Partial<GeneratedQuizProblemDto> = {},
  ): GeneratedQuizProblemDto =>
    ({
      problemText: 'What is a closure?',
      quizProblemType: QuizProblemType.SHORT_ANSWER,
      answerText: 'A function with captured scope.',
      explanation: 'Explanation.',
      difficulty: DifficultyLevel.MEDIUM,
      hasValidDifficultyFeatures: false,
      keywordIds: ['kw-1'],
      sourceChunkIds: ['chunk-1'],
      evidenceChunkIds: [],
      bloomLevel: 'UNDERSTAND',
      dokLevel: 1,
      difficultyFeatures: undefined as never,
      modelPredictedDifficulty: DifficultyLevel.MEDIUM,
      ...overrides,
    }) as GeneratedQuizProblemDto;

  const basePlan = {
    quizProblemCount: 10,
    difficultyDistribution: { easyCount: 1, mediumCount: 1, hardCount: 1 },
    targets: [{ keywordId: 'kw-1' }, { keywordId: 'kw-2' }],
    sourceChunks: [{ chunkId: 'chunk-1' }, { chunkId: 'chunk-2' }],
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // prepareGeneratedProblemsForSaving -> filterValidGeneratedProblems
  // ---------------------------------------------------------------------------
  describe('prepareGeneratedProblemsForSaving (filtering / normalization)', () => {
    it('drops problems with blank problemText or answerText', () => {
      const result = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ problemText: '   ' }),
        makeProblem({ answerText: '' }),
        makeProblem({ problemText: 'Good one' }),
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].problemText).toBe('Good one');
    });

    it('trims problemText / answerText / explanation', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          problemText: '  padded q  ',
          answerText: '  padded a  ',
          explanation: '  padded e  ',
        }),
      ]);
      expect(result.problemText).toBe('padded q');
      expect(result.answerText).toBe('padded a');
      expect(result.explanation).toBe('padded e');
    });

    it('keeps only keywordIds that belong to the plan targets and dedupes them', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ keywordIds: ['kw-1', 'kw-1', 'kw-2', 'kw-unknown'] }),
      ]);
      expect(result.keywordIds).toEqual(['kw-1', 'kw-2']);
    });

    it('drops a problem whose keywordIds are all outside the plan', () => {
      // Pair the dropped problem with a valid survivor so selection has output.
      const result = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ problemText: 'survivor' }),
        makeProblem({ problemText: 'dropped', keywordIds: ['kw-unknown'] }),
      ]);
      expect(result.map((p) => p.problemText)).toEqual(['survivor']);
    });

    it('keeps only valid sourceChunkIds and drops problems with none', () => {
      const kept = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ sourceChunkIds: ['chunk-1', 'chunk-bad'] }),
      ]);
      expect(kept[0].sourceChunkIds).toEqual(['chunk-1']);

      const result = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ problemText: 'survivor' }),
        makeProblem({ problemText: 'dropped', sourceChunkIds: ['chunk-bad'] }),
      ]);
      expect(result.map((p) => p.problemText)).toEqual(['survivor']);
    });

    it('falls back evidenceChunkIds to sourceChunkIds when none provided', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ sourceChunkIds: ['chunk-1'], evidenceChunkIds: [] }),
      ]);
      expect(result.evidenceChunkIds).toEqual(['chunk-1']);
    });

    it('filters evidenceChunkIds to valid chunks and falls back when all invalid', () => {
      const [filtered] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          sourceChunkIds: ['chunk-1', 'chunk-2'],
          evidenceChunkIds: ['chunk-2', 'chunk-bad'],
        }),
      ]);
      expect(filtered.evidenceChunkIds).toEqual(['chunk-2']);

      const [fallback] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          sourceChunkIds: ['chunk-1'],
          evidenceChunkIds: ['chunk-bad'],
        }),
      ]);
      expect(fallback.evidenceChunkIds).toEqual(['chunk-1']);
    });

    it('clears choices for SHORT_ANSWER problems (choices -> undefined)', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          quizProblemType: QuizProblemType.SHORT_ANSWER,
          choices: [
            { choiceText: 'a', isCorrect: true, displayOrder: 1 },
            { choiceText: 'b', isCorrect: false, displayOrder: 2 },
          ],
        }),
      ]);
      expect(result.choices).toBeUndefined();
    });

    it('drops a SINGLE_CHOICE problem with fewer than 2 non-empty choices', () => {
      const result = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ problemText: 'survivor' }),
        makeProblem({
          problemText: 'dropped',
          quizProblemType: QuizProblemType.SINGLE_CHOICE,
          choices: [{ choiceText: 'only', isCorrect: true, displayOrder: 1 }],
        }),
      ]);
      expect(result.map((p) => p.problemText)).toEqual(['survivor']);
    });

    it('forces exactly one correct choice for SINGLE_CHOICE and resequences displayOrder', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          quizProblemType: QuizProblemType.SINGLE_CHOICE,
          choices: [
            { choiceText: 'a', isCorrect: false, displayOrder: 5 },
            { choiceText: 'b', isCorrect: true, displayOrder: 9 },
            { choiceText: 'c', isCorrect: true, displayOrder: 2 },
          ],
        }),
      ]);
      const correct = result.choices!.filter((c) => c.isCorrect);
      expect(correct).toHaveLength(1);
      // First isCorrect in the list (index 1) wins.
      expect(result.choices![1].isCorrect).toBe(true);
      expect(result.choices!.map((c) => c.displayOrder)).toEqual([1, 2, 3]);
    });

    it('defaults SINGLE_CHOICE correct to first choice when AI marked none correct', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          quizProblemType: QuizProblemType.SINGLE_CHOICE,
          choices: [
            { choiceText: 'a', isCorrect: false, displayOrder: 1 },
            { choiceText: 'b', isCorrect: false, displayOrder: 2 },
          ],
        }),
      ]);
      expect(result.choices![0].isCorrect).toBe(true);
      expect(result.choices![1].isCorrect).toBe(false);
    });

    it('truncates choices to at most 4 for choice problems', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          quizProblemType: QuizProblemType.MULTIPLE_CHOICE,
          choices: [
            { choiceText: 'a', isCorrect: true, displayOrder: 1 },
            { choiceText: 'b', isCorrect: true, displayOrder: 2 },
            { choiceText: 'c', isCorrect: false, displayOrder: 3 },
            { choiceText: 'd', isCorrect: false, displayOrder: 4 },
            { choiceText: 'e', isCorrect: false, displayOrder: 5 },
          ],
        }),
      ]);
      expect(result.choices).toHaveLength(4);
      expect(result.choices!.map((c) => c.displayOrder)).toEqual([1, 2, 3, 4]);
    });

    it('drops empty-text choices before validating MULTIPLE_CHOICE minimum count', () => {
      const result = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({ problemText: 'survivor' }),
        makeProblem({
          problemText: 'dropped',
          quizProblemType: QuizProblemType.MULTIPLE_CHOICE,
          choices: [
            { choiceText: 'a', isCorrect: true, displayOrder: 1 },
            { choiceText: '   ', isCorrect: false, displayOrder: 2 },
          ],
        }),
      ]);
      expect(result.map((p) => p.problemText)).toEqual(['survivor']);
    });

    it('preserves multiple correct answers for MULTIPLE_CHOICE', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          quizProblemType: QuizProblemType.MULTIPLE_CHOICE,
          choices: [
            { choiceText: 'a', isCorrect: true, displayOrder: 1 },
            { choiceText: 'b', isCorrect: true, displayOrder: 2 },
            { choiceText: 'c', isCorrect: false, displayOrder: 3 },
          ],
        }),
      ]);
      expect(result.choices!.filter((c) => c.isCorrect)).toHaveLength(2);
    });

    it('uses calculateFinalDifficulty: valid features override AI-provided difficulty', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          difficulty: DifficultyLevel.EASY,
          hasValidDifficultyFeatures: true,
          difficultyFeatures: {
            conceptCount: 3,
            reasoningSteps: 3,
            requiresInference: true,
            answerExplicitInMaterial: false,
            hasDistractors: true,
            requiresComparison: true,
            requiresApplication: true,
            questionType: 'MULTI_STEP_REASONING',
          },
        }),
      ]);
      // High-complexity features -> HARD, ignoring the AI's EASY.
      expect(result.difficulty).toBe(DifficultyLevel.HARD);
    });

    it('uses calculateFinalDifficulty: falls back to AI difficulty when features invalid', () => {
      const [result] = service.prepareGeneratedProblemsForSaving(basePlan, [
        makeProblem({
          difficulty: DifficultyLevel.HARD,
          hasValidDifficultyFeatures: false,
        }),
      ]);
      expect(result.difficulty).toBe(DifficultyLevel.HARD);
    });
  });

  // ---------------------------------------------------------------------------
  // prepareGeneratedProblemsForSaving -> selectProblemsForSaving
  // ---------------------------------------------------------------------------
  describe('prepareGeneratedProblemsForSaving (selection / distribution)', () => {
    it('throws BadRequestException when no valid problems remain', () => {
      expect(() =>
        service.prepareGeneratedProblemsForSaving(basePlan, [
          makeProblem({ problemText: '' }),
        ]),
      ).toThrow(BadRequestException);
    });

    it('returns all problems unchanged when count <= quizProblemCount', () => {
      const plan = { ...basePlan, quizProblemCount: 5 };
      const result = service.prepareGeneratedProblemsForSaving(plan, [
        makeProblem({ problemText: 'q1' }),
        makeProblem({ problemText: 'q2' }),
      ]);
      expect(result.map((p) => p.problemText)).toEqual(['q1', 'q2']);
    });

    it('selects by difficulty distribution when over the target count', () => {
      const plan = {
        quizProblemCount: 3,
        difficultyDistribution: { easyCount: 1, mediumCount: 1, hardCount: 1 },
        targets: [{ keywordId: 'kw-1' }],
        sourceChunks: [{ chunkId: 'chunk-1' }],
      };
      const easy = (n: number) =>
        makeProblem({ problemText: `easy-${n}`, difficulty: DifficultyLevel.EASY });
      const medium = (n: number) =>
        makeProblem({ problemText: `med-${n}`, difficulty: DifficultyLevel.MEDIUM });
      const hard = (n: number) =>
        makeProblem({ problemText: `hard-${n}`, difficulty: DifficultyLevel.HARD });

      const result = service.prepareGeneratedProblemsForSaving(plan, [
        easy(1),
        easy(2),
        medium(1),
        medium(2),
        hard(1),
      ]);
      // One of each difficulty; final order preserves original input order.
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.problemText)).toEqual(['easy-1', 'med-1', 'hard-1']);
    });

    it('back-fills from remaining problems when a difficulty bucket is short', () => {
      const plan = {
        quizProblemCount: 3,
        difficultyDistribution: { easyCount: 1, mediumCount: 1, hardCount: 1 },
        targets: [{ keywordId: 'kw-1' }],
        sourceChunks: [{ chunkId: 'chunk-1' }],
      };
      // No HARD problems exist -> the hard slot is back-filled with an extra easy.
      const result = service.prepareGeneratedProblemsForSaving(plan, [
        makeProblem({ problemText: 'easy-1', difficulty: DifficultyLevel.EASY }),
        makeProblem({ problemText: 'easy-2', difficulty: DifficultyLevel.EASY }),
        makeProblem({ problemText: 'med-1', difficulty: DifficultyLevel.MEDIUM }),
      ]);
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.problemText).sort()).toEqual([
        'easy-1',
        'easy-2',
        'med-1',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // persistGeneratedQuiz
  // ---------------------------------------------------------------------------
  describe('persistGeneratedQuiz', () => {
    const persistInput = (problems: GeneratedQuizProblemDto[]) => ({
      userId: 'user-1',
      subjectId: 'subj-1',
      documentId: 'doc-1',
      quizType: QuizType.LECTURE,
      title: 'My Quiz',
      description: null,
      quizProblemCount: problems.length,
      generatedProblems: problems,
    });

    it('opens a transaction when no entity manager is provided', async () => {
      await service.persistGeneratedQuiz(persistInput([]));
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('reuses the provided entity manager without opening a transaction', async () => {
      await service.persistGeneratedQuiz(persistInput([]), manager as never);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalled();
    });

    it('persists the quiz, problems, choices, keyword mappings, and returns ids', async () => {
      const problems = [
        makeProblem({
          problemText: 'q1',
          quizProblemType: QuizProblemType.SINGLE_CHOICE,
          keywordIds: ['kw-1', 'kw-2'],
          choices: [
            { choiceText: 'a', isCorrect: true, displayOrder: 1 },
            { choiceText: 'b', isCorrect: false, displayOrder: 2 },
          ],
        }),
      ];

      const result = await service.persistGeneratedQuiz(persistInput(problems));

      expect(result.quiz.id).toBeDefined();
      expect(result.quizProblemIds).toHaveLength(1);

      // The quiz row was created from the input.
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          subjectId: 'subj-1',
          documentId: 'doc-1',
          quizType: QuizType.LECTURE,
          title: 'My Quiz',
          quizProblemCount: 1,
        }),
      );

      // The problem row carries a 1-based displayOrder.
      expect(quizProblemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ problemText: 'q1', displayOrder: 1 }),
      );

      // Two choices created.
      expect(quizProblemChoiceRepository.create).toHaveBeenCalledTimes(2);

      // Two distinct keywords -> weight = 1/2 = 0.5.
      expect(quizProblemKeywordRepository.create).toHaveBeenCalledTimes(2);
      const mappingArg = quizProblemKeywordRepository.create.mock.calls[0][0];
      expect(mappingArg.weight).toBe(0.5);

      // Used keywords flagged in the Keyword table.
      expect(manager.update).toHaveBeenCalledWith(
        Keyword,
        expect.anything(),
        { isUsedInAssessment: true },
      );
    });

    it('assigns weight 1 for a single-keyword problem', async () => {
      await service.persistGeneratedQuiz(
        persistInput([makeProblem({ keywordIds: ['kw-1'] })]),
      );
      const mappingArg = quizProblemKeywordRepository.create.mock.calls[0][0];
      expect(mappingArg.weight).toBe(1);
    });

    it('does not create choice rows for problems without choices', async () => {
      await service.persistGeneratedQuiz(
        persistInput([makeProblem({ choices: undefined })]),
      );
      expect(quizProblemChoiceRepository.create).not.toHaveBeenCalled();
    });

    it('skips the keyword usage update when no keywords were used', async () => {
      await service.persistGeneratedQuiz(
        persistInput([makeProblem({ keywordIds: [] })]),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('defaults documentId/description to null when omitted', async () => {
      await service.persistGeneratedQuiz({
        userId: 'user-1',
        subjectId: 'subj-1',
        quizType: QuizType.MOCK_EXAM,
        title: 'T',
        quizProblemCount: 0,
        generatedProblems: [],
      });
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: null, description: null }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createLectureQuiz (orchestration)
  // ---------------------------------------------------------------------------
  describe('createLectureQuiz', () => {
    const dto = { quizProblemCount: 2 };

    const wiredPlan = {
      userId: 'user-1',
      subjectId: 'subj-1',
      documentId: 'doc-1',
      quizProblemCount: 2,
      difficultyDistribution: { easyCount: 1, mediumCount: 1, hardCount: 0 },
      targets: [{ keywordId: 'kw-1' }],
      sourceChunks: [{ chunkId: 'chunk-1' }],
    };

    it('orchestrates target selection, AI generation, save, and returns the response', async () => {
      quizTargetSelectorService.selectLectureQuizTargets.mockResolvedValue(wiredPlan);
      quizAiGenerationService.generateLectureQuiz.mockResolvedValue([
        makeProblem({ problemText: 'q1' }),
        makeProblem({ problemText: 'q2' }),
      ]);
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', title: 'Algorithms' });

      const result = await service.createLectureQuiz('user-1', 'doc-1', dto);

      expect(quizTargetSelectorService.selectLectureQuizTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          documentId: 'doc-1',
          quizProblemCount: 2,
        }),
      );
      expect(quizAiGenerationService.generateLectureQuiz).toHaveBeenCalledWith(wiredPlan);
      expect(result).toEqual({
        quizId: expect.any(String),
        quizType: QuizType.LECTURE,
        quizProblemCount: 2,
      });
      // Title derived from document title.
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Algorithms Quiz', quizType: QuizType.LECTURE }),
      );
    });

    it('uses the default problem count when the dto omits it', async () => {
      quizTargetSelectorService.selectLectureQuizTargets.mockResolvedValue(wiredPlan);
      quizAiGenerationService.generateLectureQuiz.mockResolvedValue([
        makeProblem({ problemText: 'q1' }),
      ]);
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', title: 'Algorithms' });

      await service.createLectureQuiz('user-1', 'doc-1', {});

      expect(
        quizTargetSelectorService.selectLectureQuizTargets.mock.calls[0][0].quizProblemCount,
      ).toBe(10);
    });

    it('throws InternalServerErrorException when the target document is missing at save time', async () => {
      quizTargetSelectorService.selectLectureQuizTargets.mockResolvedValue(wiredPlan);
      quizAiGenerationService.generateLectureQuiz.mockResolvedValue([
        makeProblem({ problemText: 'q1' }),
      ]);
      documentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createLectureQuiz('user-1', 'doc-1', dto),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('falls back to a default title when the document title is blank', async () => {
      quizTargetSelectorService.selectLectureQuizTargets.mockResolvedValue(wiredPlan);
      quizAiGenerationService.generateLectureQuiz.mockResolvedValue([
        makeProblem({ problemText: 'q1' }),
      ]);
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', title: '   ' });

      await service.createLectureQuiz('user-1', 'doc-1', dto);

      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Lecture Quiz' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listDocumentQuizzes
  // ---------------------------------------------------------------------------
  describe('listDocumentQuizzes', () => {
    it('throws NotFoundException when the document is missing', async () => {
      documentRepository.findOne.mockResolvedValue(null);
      await expect(
        service.listDocumentQuizzes('user-1', 'doc-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the document belongs to another user', async () => {
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', ownerUserId: 'other' });
      await expect(
        service.listDocumentQuizzes('user-1', 'doc-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns an empty list when the document has no quizzes', async () => {
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', ownerUserId: 'user-1' });
      quizRepository.find.mockResolvedValue([]);

      const result = await service.listDocumentQuizzes('user-1', 'doc-1');
      expect(result).toEqual([]);
      expect(quizAttemptRepository.find).not.toHaveBeenCalled();
    });

    it('maps quizzes and attaches the latest attempt per quiz', async () => {
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', ownerUserId: 'user-1' });
      quizRepository.find.mockResolvedValue([
        {
          id: 'quiz-1',
          title: 'Quiz One',
          quizType: QuizType.LECTURE,
          quizProblemCount: 3,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      quizAttemptRepository.find.mockResolvedValue([
        {
          id: 'att-latest',
          quizId: 'quiz-1',
          status: 'SUBMITTED',
          startedAt: new Date('2026-02-02T00:00:00.000Z'),
          submittedAt: new Date('2026-02-02T01:00:00.000Z'),
          totalQuizProblems: 3,
          correctCount: 2,
          score: '66.6',
          createdAt: new Date('2026-02-02T00:00:00.000Z'),
        },
        {
          id: 'att-older',
          quizId: 'quiz-1',
          status: 'SUBMITTED',
          startedAt: new Date('2026-01-15T00:00:00.000Z'),
          submittedAt: new Date('2026-01-15T01:00:00.000Z'),
          totalQuizProblems: 3,
          correctCount: 1,
          score: '33.3',
          createdAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ]);

      const [item] = await service.listDocumentQuizzes('user-1', 'doc-1');

      expect(item.quizId).toBe('quiz-1');
      expect(item.title).toBe('Quiz One');
      expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
      // First attempt in the (pre-sorted) list wins as the latest.
      expect(item.latestAttempt).toMatchObject({
        attemptId: 'att-latest',
        score: 66.6,
        correctCount: 2,
        submittedAt: '2026-02-02T01:00:00.000Z',
      });
    });

    it('returns null latestAttempt and null score fields when no attempt exists', async () => {
      documentRepository.findOne.mockResolvedValue({ id: 'doc-1', ownerUserId: 'user-1' });
      quizRepository.find.mockResolvedValue([
        {
          id: 'quiz-1',
          title: 'Quiz One',
          quizType: QuizType.LECTURE,
          quizProblemCount: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      quizAttemptRepository.find.mockResolvedValue([]);

      const [item] = await service.listDocumentQuizzes('user-1', 'doc-1');
      expect(item.quizProblemCount).toBeNull();
      expect(item.latestAttempt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getQuizForSolving
  // ---------------------------------------------------------------------------
  describe('getQuizForSolving', () => {
    it('throws NotFoundException when the quiz does not exist', async () => {
      quizRepository.findOne.mockResolvedValue(null);
      await expect(
        service.getQuizForSolving('user-1', 'quiz-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the quiz belongs to another user', async () => {
      quizRepository.findOne.mockResolvedValue({ id: 'quiz-1', userId: 'other' });
      await expect(
        service.getQuizForSolving('user-1', 'quiz-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the full quiz fetch returns null', async () => {
      quizRepository.findOne
        .mockResolvedValueOnce({ id: 'quiz-1', userId: 'user-1' })
        .mockResolvedValueOnce(null);
      await expect(
        service.getQuizForSolving('user-1', 'quiz-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns problems and choices sorted by displayOrder, omitting answer fields', async () => {
      quizRepository.findOne
        .mockResolvedValueOnce({ id: 'quiz-1', userId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'quiz-1',
          title: 'Solvable Quiz',
          quizType: QuizType.LECTURE,
          quizProblems: [
            {
              id: 'p2',
              problemText: 'second',
              quizProblemType: QuizProblemType.SINGLE_CHOICE,
              difficulty: DifficultyLevel.MEDIUM,
              displayOrder: 2,
              hintLevel1: null,
              hintLevel2: null,
              hintLevel3: null,
              quizProblemChoices: [],
            },
            {
              id: 'p1',
              problemText: 'first',
              quizProblemType: QuizProblemType.SINGLE_CHOICE,
              difficulty: DifficultyLevel.EASY,
              displayOrder: 1,
              hintLevel1: 'h1',
              hintLevel2: null,
              hintLevel3: null,
              quizProblemChoices: [
                { id: 'c2', choiceText: 'B', displayOrder: 2, isCorrect: true },
                { id: 'c1', choiceText: 'A', displayOrder: 1, isCorrect: false },
              ],
            },
          ],
        });

      const result = await service.getQuizForSolving('user-1', 'quiz-1');

      expect(result.quizProblems.map((p) => p.id)).toEqual(['p1', 'p2']);
      // Choices sorted by displayOrder.
      expect(result.quizProblems[0].choices.map((c) => c.id)).toEqual(['c1', 'c2']);
      // Answer-bearing fields are not exposed.
      expect(result.quizProblems[0].choices[0]).not.toHaveProperty('isCorrect');
      expect((result.quizProblems[0] as Record<string, unknown>).answerText).toBeUndefined();
    });

    it('handles a quiz with no problems', async () => {
      quizRepository.findOne
        .mockResolvedValueOnce({ id: 'quiz-1', userId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'quiz-1',
          title: 'Empty',
          quizType: QuizType.LECTURE,
          quizProblems: undefined,
        });

      const result = await service.getQuizForSolving('user-1', 'quiz-1');
      expect(result.quizProblems).toEqual([]);
    });
  });
});
