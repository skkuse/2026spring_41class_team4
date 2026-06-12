import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

describe('KeywordsController', () => {
  let controller: KeywordsController;

  const keywordsService = {
    getSubjectKeywords: jest.fn(),
    getDocumentKeywords: jest.fn(),
  };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
    type: 'access',
  };

  const req = { user: currentUser } as Request & { user: JwtPayload };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeywordsController],
      providers: [{ provide: KeywordsService, useValue: keywordsService }],
    }).compile();

    controller = module.get<KeywordsController>(KeywordsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getSubjectKeywords to the service with subject id and user id', async () => {
    const response = [{ keywordId: 'kw-1' }];
    keywordsService.getSubjectKeywords.mockResolvedValue(response);

    const result = await controller.getSubjectKeywords('subject-1', req);

    expect(keywordsService.getSubjectKeywords).toHaveBeenCalledWith(
      'subject-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getDocumentKeywords to the service with document id and user id', async () => {
    const response = [{ keywordId: 'kw-1' }];
    keywordsService.getDocumentKeywords.mockResolvedValue(response);

    const result = await controller.getDocumentKeywords('document-1', req);

    expect(keywordsService.getDocumentKeywords).toHaveBeenCalledWith(
      'document-1',
      'user-1',
    );
    expect(result).toBe(response);
  });
});
