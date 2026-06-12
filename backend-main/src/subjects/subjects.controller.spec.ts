import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { SubjectThumbnailStorageService } from './subject-thumbnail-storage.service';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

describe('SubjectsController', () => {
  let controller: SubjectsController;

  const subjectsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
    type: 'access',
  };

  const thumbnailStorageService = {
    save: jest.fn(),
    deleteIfLocal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubjectsController],
      providers: [
        {
          provide: SubjectsService,
          useValue: subjectsService,
        },
        {
          provide: SubjectThumbnailStorageService,
          useValue: thumbnailStorageService,
        },
      ],
    }).compile();

    controller = module.get<SubjectsController>(SubjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes authenticated user id to create service call', async () => {
    subjectsService.create.mockResolvedValue({ id: 'subject-1' });

    await controller.create(currentUser, { name: 'Math' });

    expect(subjectsService.create).toHaveBeenCalledWith('user-1', { name: 'Math' });
  });

  it('passes authenticated user id to list service call', async () => {
    subjectsService.findAll.mockResolvedValue([]);

    await controller.findAll(currentUser, {});

    expect(subjectsService.findAll).toHaveBeenCalledWith('user-1', undefined);
  });

  it('passes subject name query to list service call', async () => {
    subjectsService.findAll.mockResolvedValue([]);

    await controller.findAll(currentUser, { name: 'math' });

    expect(subjectsService.findAll).toHaveBeenCalledWith('user-1', 'math');
  });
});
