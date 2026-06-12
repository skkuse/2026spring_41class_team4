import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { SubjectThumbnailStorageService } from './subject-thumbnail-storage.service';
import { SubjectsService } from './subjects.service';

describe('SubjectsService', () => {
  let service: SubjectsService;

  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const thumbnailStorageService = {
    deleteIfLocal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        {
          provide: getRepositoryToken(Subject),
          useValue: repository,
        },
        {
          provide: SubjectThumbnailStorageService,
          useValue: thumbnailStorageService,
        },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a subject for the authenticated user', async () => {
    const createdSubject = { id: 'subject-1', userId: 'user-1', name: 'Math' };
    repository.create.mockReturnValue(createdSubject);
    repository.save.mockResolvedValue(createdSubject);

    const result = await service.create('user-1', { name: 'Math' });

    expect(repository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Math',
      description: null,
      thumbnailUrl: null,
    });
    expect(result).toEqual(createdSubject);
  });

  it('returns 409 conflict when duplicate subject name exists for user', async () => {
    repository.create.mockReturnValue({});
    repository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO subjects', [], { code: '23505' }),
    );

    await expect(service.create('user-1', { name: 'Math' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('finds one subject by user scope and id', async () => {
    const subject = { id: 'subject-1', userId: 'user-1', name: 'Math' };
    repository.findOne.mockResolvedValue(subject);

    const result = await service.findOne('user-1', 'subject-1');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'subject-1', userId: 'user-1' },
    });
    expect(result).toEqual(subject);
  });

  it('throws not found when user cannot access subject', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne('user-1', 'subject-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists subjects scoped by user when no search query', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll('user-1');

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('applies name search with ilike when query exists', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll('user-1', 'math');

    const findArg = repository.find.mock.calls[0][0];
    expect(findArg.where.userId).toBe('user-1');
    expect(findArg.where.name.type).toBe('ilike');
    expect(findArg.where.name.value).toBe('%math%');
  });

  it('deletes previous local thumbnail when update changes thumbnail url', async () => {
    repository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/old.png',
    });
    repository.save.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/new.png',
    });

    await service.update('user-1', 'subject-1', {
      thumbnailUrl: '/uploads/subject-thumbnails/new.png',
    });

    expect(thumbnailStorageService.deleteIfLocal).toHaveBeenCalledWith(
      '/uploads/subject-thumbnails/old.png',
    );
  });

  it('deletes thumbnail file when subject is removed', async () => {
    repository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/old.png',
    });
    repository.delete.mockResolvedValue({ affected: 1 });

    await service.remove('user-1', 'subject-1');

    expect(repository.delete).toHaveBeenCalledWith({
      id: 'subject-1',
      userId: 'user-1',
    });
    expect(thumbnailStorageService.deleteIfLocal).toHaveBeenCalledWith(
      '/uploads/subject-thumbnails/old.png',
    );
  });

  it('does not fail update when previous thumbnail cleanup fails', async () => {
    repository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/old.png',
    });
    repository.save.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/new.png',
    });
    thumbnailStorageService.deleteIfLocal.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    await expect(
      service.update('user-1', 'subject-1', {
        thumbnailUrl: '/uploads/subject-thumbnails/new.png',
      }),
    ).resolves.toEqual({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/new.png',
    });
  });

  it('does not fail remove when thumbnail cleanup fails', async () => {
    repository.findOne.mockResolvedValue({
      id: 'subject-1',
      userId: 'user-1',
      name: 'Math',
      thumbnailUrl: '/uploads/subject-thumbnails/old.png',
    });
    repository.delete.mockResolvedValue({ affected: 1 });
    thumbnailStorageService.deleteIfLocal.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    await expect(service.remove('user-1', 'subject-1')).resolves.toBeUndefined();
  });
});
