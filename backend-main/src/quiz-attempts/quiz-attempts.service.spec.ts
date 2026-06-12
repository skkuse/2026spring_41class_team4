import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { QuizProblemChoiceEntity } from '../quiz/entities/quiz-problem-choice.entity';
import { QuizProblemEntity } from '../quiz/entities/quiz-problem.entity';
import { QuizProblemType } from '../quiz/enums/quiz-problem-type.enum';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { AttemptStatus } from './enums/attempt-status.enum';
import { QuizAttemptsService } from './quiz-attempts.service';

describe('QuizAttemptsService grading', () => {
  let service: QuizAttemptsService;

  beforeEach(() => {
    service = new QuizAttemptsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('allows empty selectedChoiceIds at DTO validation level', async () => {
    const dto = Object.assign(new SubmitAnswerDto(), {
      quizProblemId: '11111111-1111-4111-8111-111111111111',
      selectedChoiceIds: [],
      usedHint: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('marks zero-correct MULTIPLE_CHOICE correct when empty array is submitted', () => {
    const result = gradeAnswer(service, createMultipleChoiceProblem([]), {
      quizProblemId: 'problem-id',
      selectedChoiceIds: [],
      usedHint: false,
    });

    expect(result).toEqual({
      isCorrect: true,
      userAnswerToStore: '[]',
      selectedChoiceIds: [],
    });
  });

  it('requires selectedChoiceIds to be provided for MULTIPLE_CHOICE', () => {
    expect(() =>
      gradeAnswer(service, createMultipleChoiceProblem([]), {
        quizProblemId: 'problem-id',
        usedHint: false,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      gradeAnswer(service, createMultipleChoiceProblem([]), {
        quizProblemId: 'problem-id',
        selectedChoiceIds: null as never,
        usedHint: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('stores MULTIPLE_CHOICE selected choice IDs as sorted JSON', () => {
    const result = gradeAnswer(
      service,
      createMultipleChoiceProblem(['b-choice']),
      {
        quizProblemId: 'problem-id',
        selectedChoiceIds: ['c-choice', 'b-choice'],
        usedHint: false,
      },
    );

    expect(result.isCorrect).toBe(false);
    expect(result.userAnswerToStore).toBe('["b-choice","c-choice"]');
    expect(result.selectedChoiceIds).toEqual(['b-choice', 'c-choice']);
  });

  it('keeps SINGLE_CHOICE behavior requiring one selected choice', () => {
    expect(() =>
      gradeAnswer(service, createSingleChoiceProblem('a-choice'), {
        quizProblemId: 'problem-id',
        usedHint: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('marks missing and null-correctness problems incorrect on final submit', async () => {
    const {
      service: submitService,
      quizProblemRepository,
      quizAttemptRepository,
      quizProblemAttemptRepository,
      masteryService,
    } = createSubmitAttemptService();
    quizAttemptRepository.findOne.mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      status: AttemptStatus.IN_PROGRESS,
    });
    quizProblemRepository.find.mockResolvedValue([
      { id: 'problem-1' },
      { id: 'problem-2' },
      { id: 'problem-3' },
    ]);
    quizProblemAttemptRepository.find.mockResolvedValue([
      {
        quizAttemptId: 'attempt-1',
        quizProblemId: 'problem-1',
        userId: 'user-1',
        isCorrect: true,
      },
      {
        quizAttemptId: 'attempt-1',
        quizProblemId: 'problem-2',
        userId: 'user-1',
        isCorrect: null,
        usedHint: true,
        submittedAt: null,
      },
    ]);
    quizProblemAttemptRepository.create.mockImplementation((value) => ({
      ...value,
      id: 'created-attempt',
    }));
    quizProblemAttemptRepository.save.mockResolvedValue(undefined);
    quizProblemAttemptRepository.count.mockResolvedValue(1);
    quizAttemptRepository.save.mockImplementation(async (value) => value);
    masteryService.updateMasteryForProblemAnswer.mockResolvedValue([]);

    await expect(
      submitService.submitAttempt('user-1', 'attempt-1'),
    ).resolves.toEqual({
      attemptId: 'attempt-1',
      status: AttemptStatus.GRADED,
      totalQuizProblems: 3,
      correctCount: 1,
      score: 33.33,
    });

    expect(quizProblemAttemptRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        quizAttemptId: 'attempt-1',
        quizProblemId: 'problem-2',
        isCorrect: false,
      }),
      expect.objectContaining({
        quizAttemptId: 'attempt-1',
        quizProblemId: 'problem-3',
        userId: 'user-1',
        userAnswer: null,
        isCorrect: false,
        usedHint: false,
        hintLevelUsed: null,
        elapsedSeconds: null,
      }),
    ]);
    expect(masteryService.updateMasteryForProblemAnswer).toHaveBeenCalledTimes(
      2,
    );
    expect(masteryService.updateMasteryForProblemAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        quizProblemId: 'problem-2',
      }),
    );
    expect(masteryService.updateMasteryForProblemAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        quizProblemId: 'problem-3',
      }),
    );
    expect(quizAttemptRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AttemptStatus.GRADED,
        totalQuizProblems: 3,
        correctCount: 1,
        score: 33.33,
      }),
    );
  });

  it('does not create final-submit attempts when all problems are already graded', async () => {
    const {
      service: submitService,
      quizProblemRepository,
      quizAttemptRepository,
      quizProblemAttemptRepository,
      masteryService,
    } = createSubmitAttemptService();
    quizAttemptRepository.findOne.mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      status: AttemptStatus.IN_PROGRESS,
    });
    quizProblemRepository.find.mockResolvedValue([{ id: 'problem-1' }]);
    quizProblemAttemptRepository.find.mockResolvedValue([
      {
        quizAttemptId: 'attempt-1',
        quizProblemId: 'problem-1',
        userId: 'user-1',
        isCorrect: false,
      },
    ]);
    quizProblemAttemptRepository.count.mockResolvedValue(0);
    quizAttemptRepository.save.mockImplementation(async (value) => value);

    await submitService.submitAttempt('user-1', 'attempt-1');

    expect(quizProblemAttemptRepository.save).not.toHaveBeenCalled();
    expect(masteryService.updateMasteryForProblemAnswer).not.toHaveBeenCalled();
  });
});

function createSubmitAttemptService() {
  const quizRepository = createMockRepository();
  const quizProblemRepository = createMockRepository();
  const quizAttemptRepository = createMockRepository();
  const quizProblemAttemptRepository = createMockRepository();
  const masteryService = {
    updateMasteryForProblemAnswer: jest.fn(),
  };

  return {
    service: new QuizAttemptsService(
      quizRepository as never,
      quizProblemRepository as never,
      quizAttemptRepository as never,
      quizProblemAttemptRepository as never,
      masteryService as never,
    ),
    quizRepository,
    quizProblemRepository,
    quizAttemptRepository,
    quizProblemAttemptRepository,
    masteryService,
  };
}

function createMockRepository() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

function gradeAnswer(
  service: QuizAttemptsService,
  quizProblem: QuizProblemEntity,
  dto: SubmitAnswerDto,
): {
  isCorrect: boolean;
  userAnswerToStore: string | null;
  selectedChoiceIds?: string[];
} {
  return (
    service as unknown as {
      gradeAnswer: (
        quizProblem: QuizProblemEntity,
        dto: SubmitAnswerDto,
      ) => {
        isCorrect: boolean;
        userAnswerToStore: string | null;
        selectedChoiceIds?: string[];
      };
    }
  ).gradeAnswer(quizProblem, dto);
}

function createMultipleChoiceProblem(
  correctChoiceIds: string[],
): QuizProblemEntity {
  return {
    id: 'problem-id',
    quizProblemType: QuizProblemType.MULTIPLE_CHOICE,
    quizProblemChoices: createChoices(correctChoiceIds),
  } as QuizProblemEntity;
}

function createSingleChoiceProblem(correctChoiceId: string): QuizProblemEntity {
  return {
    id: 'problem-id',
    quizProblemType: QuizProblemType.SINGLE_CHOICE,
    quizProblemChoices: createChoices([correctChoiceId]),
  } as QuizProblemEntity;
}

function createChoices(correctChoiceIds: string[]): QuizProblemChoiceEntity[] {
  return ['a-choice', 'b-choice', 'c-choice', 'd-choice'].map((id, index) => ({
    id,
    choiceText: `Choice ${index + 1}`,
    isCorrect: correctChoiceIds.includes(id),
    displayOrder: index + 1,
  })) as QuizProblemChoiceEntity[];
}
