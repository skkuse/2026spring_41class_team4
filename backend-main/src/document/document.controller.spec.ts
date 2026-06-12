import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { MasteryService } from '../mastery/mastery.service';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

describe('DocumentController', () => {
  let controller: DocumentController;

  const documentService = {
    uploadToSubject: jest.fn(),
    listSubjectDocuments: jest.fn(),
    analyzeDocument: jest.fn(),
    getDocumentDetail: jest.fn(),
    getDocumentStatus: jest.fn(),
    updateDocumentTitle: jest.fn(),
    deleteDocument: jest.fn(),
  };

  const masteryService = {
    getDocumentLearningStatus: jest.fn(),
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
      controllers: [DocumentController],
      providers: [
        { provide: DocumentService, useValue: documentService },
        { provide: MasteryService, useValue: masteryService },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates uploadToSubject to the service with subject id, file, user id and title', async () => {
    const file = {
      originalname: 'doc.pdf',
      buffer: Buffer.from('data'),
    } as Express.Multer.File;
    const dto = { title: 'My Title' };
    const response = { documentId: 'doc-1' };
    documentService.uploadToSubject.mockResolvedValue(response);

    const result = await controller.uploadToSubject(
      'subject-1',
      dto,
      file,
      req,
    );

    expect(documentService.uploadToSubject).toHaveBeenCalledWith(
      'subject-1',
      file,
      'user-1',
      'My Title',
    );
    expect(result).toBe(response);
  });

  it('passes undefined title through when dto omits it', async () => {
    const file = { originalname: 'doc.pdf' } as Express.Multer.File;
    documentService.uploadToSubject.mockResolvedValue({ documentId: 'doc-1' });

    await controller.uploadToSubject('subject-1', {}, file, req);

    expect(documentService.uploadToSubject).toHaveBeenCalledWith(
      'subject-1',
      file,
      'user-1',
      undefined,
    );
  });

  it('delegates listBySubject to the service with subject id and user id', async () => {
    const response = [{ documentId: 'doc-1' }];
    documentService.listSubjectDocuments.mockResolvedValue(response);

    const result = await controller.listBySubject('subject-1', req);

    expect(documentService.listSubjectDocuments).toHaveBeenCalledWith(
      'subject-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('delegates analyze to the service with document id and user id', async () => {
    const response = { status: 'PROCESSING' };
    documentService.analyzeDocument.mockResolvedValue(response);

    const result = await controller.analyze('document-1', req);

    expect(documentService.analyzeDocument).toHaveBeenCalledWith(
      'document-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getDetail to the service with document id and user id', async () => {
    const response = { documentId: 'document-1' };
    documentService.getDocumentDetail.mockResolvedValue(response);

    const result = await controller.getDetail('document-1', req);

    expect(documentService.getDocumentDetail).toHaveBeenCalledWith(
      'document-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getStatus to the service with document id and user id', async () => {
    const response = { status: 'READY' };
    documentService.getDocumentStatus.mockResolvedValue(response);

    const result = await controller.getStatus('document-1', req);

    expect(documentService.getDocumentStatus).toHaveBeenCalledWith(
      'document-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('delegates getLearningStatus to the mastery service with user id and document id', async () => {
    const response = { learned: 3 };
    masteryService.getDocumentLearningStatus.mockResolvedValue(response);

    const result = await controller.getLearningStatus('document-1', req);

    expect(masteryService.getDocumentLearningStatus).toHaveBeenCalledWith(
      'user-1',
      'document-1',
    );
    expect(result).toBe(response);
  });

  it('delegates updateTitle to the service with document id, user id and title', async () => {
    const dto = { title: 'New Title' };
    const response = { documentId: 'document-1', title: 'New Title' };
    documentService.updateDocumentTitle.mockResolvedValue(response);

    const result = await controller.updateTitle('document-1', dto, req);

    expect(documentService.updateDocumentTitle).toHaveBeenCalledWith(
      'document-1',
      'user-1',
      'New Title',
    );
    expect(result).toBe(response);
  });

  it('delegates deleteDocument to the service with document id and user id', async () => {
    const response = { deleted: true };
    documentService.deleteDocument.mockResolvedValue(response);

    const result = await controller.deleteDocument('document-1', req);

    expect(documentService.deleteDocument).toHaveBeenCalledWith(
      'document-1',
      'user-1',
    );
    expect(result).toBe(response);
  });
});
