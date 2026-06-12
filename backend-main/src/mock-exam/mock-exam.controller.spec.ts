import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { QuizType } from '../quiz/enums/quiz-type.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { CreateMockExamDto } from './dto/create-mock-exam.dto';
import { MockExamController } from './mock-exam.controller';
import { MockExamService } from './mock-exam.service';

describe('MockExamController', () => {
  let controller: MockExamController;

  const mockExamService = {
    createMockExam: jest.fn(),
    listMockExams: jest.fn(),
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
      controllers: [MockExamController],
      providers: [{ provide: MockExamService, useValue: mockExamService }],
    }).compile();

    controller = module.get<MockExamController>(MockExamController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates creation to the service with the authenticated user id', async () => {
    const dto: CreateMockExamDto = { quizProblemCount: 10 };
    const response = {
      mockExamId: 'me-1',
      quizId: 'quiz-1',
      quizType: QuizType.MOCK_EXAM,
      quizProblemCount: 10,
    };
    mockExamService.createMockExam.mockResolvedValue(response);

    const result = await controller.createMockExam(currentUser, 'subject-1', dto);

    expect(mockExamService.createMockExam).toHaveBeenCalledWith(
      'user-1',
      'subject-1',
      dto,
    );
    expect(result).toBe(response);
  });

  it('delegates listing to the service scoped by user and subject', async () => {
    const items = [{ mockExamId: 'me-1' }];
    mockExamService.listMockExams.mockResolvedValue(items);

    const result = await controller.listMockExams(currentUser, 'subject-1');

    expect(mockExamService.listMockExams).toHaveBeenCalledWith('user-1', 'subject-1');
    expect(result).toBe(items);
  });
});
