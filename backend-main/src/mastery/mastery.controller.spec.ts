import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { MasteryController } from './mastery.controller';
import { MasteryService } from './mastery.service';

describe('MasteryController', () => {
  let controller: MasteryController;

  const masteryService = {
    getSubjectMastery: jest.fn(),
    getSubjectLearningStatus: jest.fn(),
    getSubjectDashboard: jest.fn(),
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
      controllers: [MasteryController],
      providers: [{ provide: MasteryService, useValue: masteryService }],
    }).compile();

    controller = module.get<MasteryController>(MasteryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getSubjectMastery to the service with user id and subject id', async () => {
    const response = { subjectId: 'subject-1' };
    masteryService.getSubjectMastery.mockResolvedValue(response);

    const result = await controller.getSubjectMastery(currentUser, 'subject-1');

    expect(masteryService.getSubjectMastery).toHaveBeenCalledWith(
      'user-1',
      'subject-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getSubjectLearningStatus to the service with user id and subject id', async () => {
    const response = { subjectId: 'subject-1' };
    masteryService.getSubjectLearningStatus.mockResolvedValue(response);

    const result = await controller.getSubjectLearningStatus(
      currentUser,
      'subject-1',
    );

    expect(masteryService.getSubjectLearningStatus).toHaveBeenCalledWith(
      'user-1',
      'subject-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getSubjectDashboard to the service with user id and subject id', async () => {
    const response = { subjectId: 'subject-1' };
    masteryService.getSubjectDashboard.mockResolvedValue(response);

    const result = await controller.getSubjectDashboard(
      currentUser,
      'subject-1',
    );

    expect(masteryService.getSubjectDashboard).toHaveBeenCalledWith(
      'user-1',
      'subject-1',
    );
    expect(result).toBe(response);
  });
});
