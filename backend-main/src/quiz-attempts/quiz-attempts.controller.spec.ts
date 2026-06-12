import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';

describe('QuizAttemptsController', () => {
  let controller: QuizAttemptsController;

  const quizAttemptsService = {
    startAttempt: jest.fn(),
    submitAnswer: jest.fn(),
    submitAttempt: jest.fn(),
    getAttemptReview: jest.fn(),
  };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
    type: 'access',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizAttemptsController],
      providers: [
        { provide: QuizAttemptsService, useValue: quizAttemptsService },
      ],
    }).compile();

    controller = module.get<QuizAttemptsController>(QuizAttemptsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates startAttempt to the service with user id and quiz id', async () => {
    const response = { attemptId: 'attempt-1' };
    quizAttemptsService.startAttempt.mockResolvedValue(response);

    const result = await controller.startAttempt(currentUser, 'quiz-1');

    expect(quizAttemptsService.startAttempt).toHaveBeenCalledWith(
      'user-1',
      'quiz-1',
    );
    expect(result).toBe(response);
  });

  it('delegates submitAnswer to the service with user id, attempt id and dto', async () => {
    const dto: SubmitAnswerDto = {
      quizProblemId: 'problem-1',
      usedHint: false,
    };
    const response = { correct: true };
    quizAttemptsService.submitAnswer.mockResolvedValue(response);

    const result = await controller.submitAnswer(currentUser, 'attempt-1', dto);

    expect(quizAttemptsService.submitAnswer).toHaveBeenCalledWith(
      'user-1',
      'attempt-1',
      dto,
    );
    expect(result).toBe(response);
  });

  it('delegates submitAttempt to the service with user id and attempt id', async () => {
    const response = { score: 90 };
    quizAttemptsService.submitAttempt.mockResolvedValue(response);

    const result = await controller.submitAttempt(currentUser, 'attempt-1');

    expect(quizAttemptsService.submitAttempt).toHaveBeenCalledWith(
      'user-1',
      'attempt-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getReview to the service with user id and attempt id', async () => {
    const response = { items: [] };
    quizAttemptsService.getAttemptReview.mockResolvedValue(response);

    const result = await controller.getReview(currentUser, 'attempt-1');

    expect(quizAttemptsService.getAttemptReview).toHaveBeenCalledWith(
      'user-1',
      'attempt-1',
    );
    expect(result).toBe(response);
  });
});
