import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KeywordsService } from '../keywords/keywords.service';
import { SubjectsService } from '../subjects/subjects.service';
import { DocumentAnalysisAiService } from './document-analysis-ai.service';
import { DocumentFileStorageService } from './document-file-storage.service';
import { DocumentPreprocessingService } from './document-preprocessing.service';
import { DocumentService } from './document.service';
import { DocumentChunkEntity } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { PdfParserService } from './pdf-parser.service';

const fsPromisesMock = {
  readFile: jest.fn(),
  rm: jest.fn(),
};

jest.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => fsPromisesMock.readFile(...args),
  rm: (...args: unknown[]) => fsPromisesMock.rm(...args),
}));

describe('DocumentService', () => {
  let service: DocumentService;

  // transaction manager used by replaceDocumentChunks
  const manager = {
    delete: jest.fn(),
    create: jest.fn((_entity, row) => row),
    insert: jest.fn(),
    find: jest.fn(),
  };

  const documentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const documentChunkRepository = {
    find: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const subjectsService = { findOne: jest.fn() };
  const keywordsService = {
    upsertKeywordsForDocument: jest.fn(),
    getDocumentKeywords: jest.fn(),
  };
  const pdfParserService = { parse: jest.fn() };
  const documentFileStorageService = {
    savePdf: jest.fn(),
    deleteIfLocal: jest.fn(),
  };
  const documentPreprocessingService = {
    parseCleanedMarkdownToChunks: jest.fn(),
  };
  const documentAnalysisAiService = { analyzeDocument: jest.fn() };

  const buildFile = (): Express.Multer.File =>
    ({
      originalname: 'lecture.pdf',
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File);

  const buildDocument = (overrides: Partial<DocumentEntity> = {}): DocumentEntity =>
    ({
      id: 'doc-1',
      ownerUserId: 'user-1',
      subjectId: 'subject-1',
      title: 'Lecture',
      originalFileName: 'lecture.pdf',
      fileUrl: '/uploads/documents/abc.pdf',
      outputDir: '/tmp/out',
      markdownFiles: ['/tmp/out/page1.md'],
      analysisStatus: 'UPLOADED',
      overallSummary: null,
      analysisErrorMessage: null,
      pageCount: 3,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      ...overrides,
    } as DocumentEntity);

  beforeEach(async () => {
    jest.clearAllMocks();

    fsPromisesMock.readFile.mockResolvedValue('cleaned markdown content');
    fsPromisesMock.rm.mockResolvedValue(undefined);

    documentChunkRepository.manager.transaction.mockImplementation(async (cb) =>
      cb(manager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getRepositoryToken(DocumentEntity), useValue: documentRepository },
        {
          provide: getRepositoryToken(DocumentChunkEntity),
          useValue: documentChunkRepository,
        },
        { provide: SubjectsService, useValue: subjectsService },
        { provide: KeywordsService, useValue: keywordsService },
        { provide: PdfParserService, useValue: pdfParserService },
        {
          provide: DocumentFileStorageService,
          useValue: documentFileStorageService,
        },
        {
          provide: DocumentPreprocessingService,
          useValue: documentPreprocessingService,
        },
        {
          provide: DocumentAnalysisAiService,
          useValue: documentAnalysisAiService,
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadToSubject', () => {
    it('verifies subject ownership, stores file, parses, persists, and builds chunks', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1' });
      documentFileStorageService.savePdf.mockResolvedValue({
        fileUrl: '/uploads/documents/abc.pdf',
        originalFileName: 'lecture.pdf',
      });
      pdfParserService.parse.mockResolvedValue({
        documentId: 'doc-1',
        outputDir: '/tmp/out',
        jsonFiles: [],
        markdownFiles: ['/tmp/out/page1.md'],
        imageFiles: [],
        totalPages: 3,
      });
      const persisted = buildDocument();
      documentRepository.save.mockResolvedValue(persisted);
      fsPromisesMock.readFile.mockResolvedValue('# Page 1 - Intro\nbody');
      documentPreprocessingService.parseCleanedMarkdownToChunks.mockReturnValue([
        { pageNumber: 1, heading: 'Intro', content: 'body', displayOrder: 1 },
      ]);
      manager.find.mockResolvedValue([{ id: 'chunk-1' }]);

      const result = await service.uploadToSubject(
        'subject-1',
        buildFile(),
        'user-1',
        '  My Title  ',
      );

      expect(subjectsService.findOne).toHaveBeenCalledWith('user-1', 'subject-1');
      expect(documentFileStorageService.savePdf).toHaveBeenCalled();
      expect(pdfParserService.parse).toHaveBeenCalled();
      // title normalized (trimmed) when persisting
      expect(documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'doc-1',
          ownerUserId: 'user-1',
          subjectId: 'subject-1',
          title: 'My Title',
          analysisStatus: 'UPLOADED',
        }),
      );
      // chunks replaced via transaction
      expect(documentChunkRepository.manager.transaction).toHaveBeenCalled();
      expect(manager.delete).toHaveBeenCalledWith(DocumentChunkEntity, {
        documentId: 'doc-1',
      });
      expect(manager.insert).toHaveBeenCalled();

      expect(result).toEqual({
        documentId: 'doc-1',
        fileUrl: '/uploads/documents/abc.pdf',
        pageCount: 3,
        analysisStatus: 'UPLOADED',
        canAnalyze: true,
      });
    });

    it('propagates subject ownership failures (no upload performed)', async () => {
      subjectsService.findOne.mockRejectedValue(new NotFoundException('Subject not found.'));

      await expect(
        service.uploadToSubject('subject-x', buildFile(), 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(documentFileStorageService.savePdf).not.toHaveBeenCalled();
      expect(pdfParserService.parse).not.toHaveBeenCalled();
    });

    it('rejects with 400 and cleans up row/output/file when no chunks can be parsed', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1' });
      documentFileStorageService.savePdf.mockResolvedValue({
        fileUrl: '/uploads/documents/abc.pdf',
        originalFileName: 'lecture.pdf',
      });
      pdfParserService.parse.mockResolvedValue({
        documentId: 'doc-1',
        outputDir: '/tmp/out',
        markdownFiles: ['/tmp/out/page1.md'],
        totalPages: 1,
      });
      documentRepository.save.mockResolvedValue(buildDocument());
      fsPromisesMock.readFile.mockResolvedValue('some markdown');
      documentPreprocessingService.parseCleanedMarkdownToChunks.mockReturnValue([]);

      await expect(
        service.uploadToSubject('subject-1', buildFile(), 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      // ISSUE-008: a failed upload must not leave orphans behind.
      expect(documentRepository.delete).toHaveBeenCalledWith({ id: 'doc-1' });
      expect(fsPromisesMock.rm).toHaveBeenCalledWith('/tmp/out', {
        recursive: true,
        force: true,
      });
      expect(documentFileStorageService.deleteIfLocal).toHaveBeenCalledWith(
        '/uploads/documents/abc.pdf',
      );
    });

    it('rejects with 400 and cleans up when no preprocessed text is available (ISSUE-008)', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1' });
      documentFileStorageService.savePdf.mockResolvedValue({
        fileUrl: '/uploads/documents/abc.pdf',
        originalFileName: 'lecture.pdf',
      });
      pdfParserService.parse.mockResolvedValue({
        documentId: 'doc-1',
        outputDir: '/tmp/out',
        markdownFiles: ['/tmp/out/page1.md'],
        totalPages: 1,
      });
      documentRepository.save.mockResolvedValue(buildDocument());
      // cleaned-openai-input.md AND every markdown fallback read fail -> no text.
      fsPromisesMock.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(
        service.uploadToSubject('subject-1', buildFile(), 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(documentRepository.delete).toHaveBeenCalledWith({ id: 'doc-1' });
      expect(documentFileStorageService.deleteIfLocal).toHaveBeenCalledWith(
        '/uploads/documents/abc.pdf',
      );
    });

    it('keeps infra failures as 500 (rethrows) while still cleaning up the stored file', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1' });
      documentFileStorageService.savePdf.mockResolvedValue({
        fileUrl: '/uploads/documents/abc.pdf',
        originalFileName: 'lecture.pdf',
      });
      // e.g. the pdf parser's java runtime is missing on the host —
      // this is NOT the user's fault and must stay visible to operators.
      pdfParserService.parse.mockRejectedValue(new Error('spawn java ENOENT'));

      await expect(
        service.uploadToSubject('subject-1', buildFile(), 'user-1'),
      ).rejects.toThrow('spawn java ENOENT');

      // No document row was created, so only the stored file needs cleanup.
      expect(documentRepository.delete).not.toHaveBeenCalled();
      expect(documentFileStorageService.deleteIfLocal).toHaveBeenCalledWith(
        '/uploads/documents/abc.pdf',
      );
    });
  });

  describe('listSubjectDocuments', () => {
    it('scopes the query to the subject + owner and maps metadata', async () => {
      subjectsService.findOne.mockResolvedValue({ id: 'subject-1' });
      documentRepository.find.mockResolvedValue([buildDocument()]);

      const result = await service.listSubjectDocuments('subject-1', 'user-1');

      expect(subjectsService.findOne).toHaveBeenCalledWith('user-1', 'subject-1');
      expect(documentRepository.find).toHaveBeenCalledWith({
        where: { subjectId: 'subject-1', ownerUserId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        documentId: 'doc-1',
        title: 'Lecture',
        analysisStatus: 'UPLOADED',
      });
    });
  });

  describe('analyzeDocument', () => {
    const analyzedChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        heading: 'Intro',
        content: 'body',
        visualNote: null,
        displayOrder: 1,
      },
    ];

    it('transitions PROCESSING -> ANALYZED and returns keyword summary', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.update.mockResolvedValue({ affected: 1 });
      fsPromisesMock.readFile.mockResolvedValue('cleaned openai input');
      documentChunkRepository.find.mockResolvedValue(analyzedChunks);
      documentAnalysisAiService.analyzeDocument.mockResolvedValue({
        overallSummary: 'a summary',
        keywords: [{ name: 'kw' }],
      });
      keywordsService.upsertKeywordsForDocument.mockResolvedValue([
        { id: 'kw-1', name: 'Closures', importanceScore: 0.8 },
      ]);

      const result = await service.analyzeDocument('doc-1', 'user-1');

      // first update sets PROCESSING and clears error
      expect(documentRepository.update).toHaveBeenNthCalledWith(
        1,
        { id: 'doc-1' },
        { analysisStatus: 'PROCESSING', analysisErrorMessage: null },
      );
      // final update sets ANALYZED with summary
      expect(documentRepository.update).toHaveBeenNthCalledWith(
        2,
        { id: 'doc-1' },
        {
          overallSummary: 'a summary',
          analysisStatus: 'ANALYZED',
          analysisErrorMessage: null,
        },
      );
      expect(result).toEqual({
        documentId: 'doc-1',
        analysisStatus: 'ANALYZED',
        overallSummary: 'a summary',
        keywordCount: 1,
        keywords: [{ id: 'kw-1', name: 'Closures', importanceScore: 0.8 }],
      });
    });

    it('defaults importanceScore to 0.5 when keyword row lacks one', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.update.mockResolvedValue({ affected: 1 });
      fsPromisesMock.readFile.mockResolvedValue('cleaned openai input');
      documentChunkRepository.find.mockResolvedValue(analyzedChunks);
      documentAnalysisAiService.analyzeDocument.mockResolvedValue({
        overallSummary: 's',
        keywords: [],
      });
      keywordsService.upsertKeywordsForDocument.mockResolvedValue([
        { id: 'kw-2', name: 'No score', importanceScore: null },
      ]);

      const result = await service.analyzeDocument('doc-1', 'user-1');

      expect(result.keywords[0].importanceScore).toBe(0.5);
    });

    it('marks the document FAILED and throws when there are no chunks', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.update.mockResolvedValue({ affected: 1 });
      fsPromisesMock.readFile.mockResolvedValue('cleaned openai input');
      documentChunkRepository.find.mockResolvedValue([]);

      await expect(service.analyzeDocument('doc-1', 'user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      expect(documentAnalysisAiService.analyzeDocument).not.toHaveBeenCalled();
      // last update transitions to FAILED carrying the error message
      const failureCall = documentRepository.update.mock.calls.at(-1);
      expect(failureCall?.[1]).toMatchObject({ analysisStatus: 'FAILED' });
      expect(failureCall?.[1].analysisErrorMessage).toContain('No document_chunks found');
    });

    it('marks FAILED when the AI service throws', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.update.mockResolvedValue({ affected: 1 });
      fsPromisesMock.readFile.mockResolvedValue('cleaned openai input');
      documentChunkRepository.find.mockResolvedValue(analyzedChunks);
      documentAnalysisAiService.analyzeDocument.mockRejectedValue(
        new Error('AI exploded'),
      );

      await expect(service.analyzeDocument('doc-1', 'user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      const failureCall = documentRepository.update.mock.calls.at(-1);
      expect(failureCall?.[1]).toMatchObject({
        analysisStatus: 'FAILED',
        analysisErrorMessage: 'AI exploded',
      });
      expect(keywordsService.upsertKeywordsForDocument).not.toHaveBeenCalled();
    });

    it('marks FAILED when no preprocessed text is available', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ outputDir: null, markdownFiles: [] }),
      );
      documentRepository.update.mockResolvedValue({ affected: 1 });

      await expect(service.analyzeDocument('doc-1', 'user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      const failureCall = documentRepository.update.mock.calls.at(-1);
      expect(failureCall?.[1].analysisErrorMessage).toContain(
        'No preprocessed document text available',
      );
    });

    it('falls back to merged markdown files when cleaned file read fails', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.update.mockResolvedValue({ affected: 1 });
      // cleaned-openai-input.md read fails, markdown file read succeeds
      fsPromisesMock.readFile
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce('merged page text');
      documentChunkRepository.find.mockResolvedValue(analyzedChunks);
      documentAnalysisAiService.analyzeDocument.mockResolvedValue({
        overallSummary: 's',
        keywords: [],
      });
      keywordsService.upsertKeywordsForDocument.mockResolvedValue([]);

      const result = await service.analyzeDocument('doc-1', 'user-1');

      expect(result.analysisStatus).toBe('ANALYZED');
      const aiArg = documentAnalysisAiService.analyzeDocument.mock.calls[0][0];
      expect(aiArg.cleanedMarkdown).toBe('merged page text');
    });

    it('rejects analyze on a document owned by another user', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ ownerUserId: 'other-user' }),
      );

      await expect(service.analyzeDocument('doc-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(documentRepository.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the document does not exist', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(service.analyzeDocument('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getDocumentDetail', () => {
    it('returns detail with keywords for the owner', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ overallSummary: 'sum' }),
      );
      keywordsService.getDocumentKeywords.mockResolvedValue([
        { id: 'kw-1', name: 'Closures', importanceScore: null },
      ]);

      const result = await service.getDocumentDetail('doc-1', 'user-1');

      expect(keywordsService.getDocumentKeywords).toHaveBeenCalledWith('doc-1', 'user-1');
      expect(result).toEqual({
        documentId: 'doc-1',
        subjectId: 'subject-1',
        fileUrl: '/uploads/documents/abc.pdf',
        pageCount: 3,
        analysisStatus: 'UPLOADED',
        overallSummary: 'sum',
        keywords: [{ id: 'kw-1', name: 'Closures', importanceScore: 0.5 }],
      });
    });

    it('denies detail to a non-owner', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ ownerUserId: 'other' }),
      );

      await expect(
        service.getDocumentDetail('doc-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(keywordsService.getDocumentKeywords).not.toHaveBeenCalled();
    });
  });

  describe('getDocumentStatus', () => {
    it('returns the current status and error message', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ analysisStatus: 'FAILED', analysisErrorMessage: 'boom' }),
      );

      const result = await service.getDocumentStatus('doc-1', 'user-1');

      expect(result).toEqual({
        documentId: 'doc-1',
        analysisStatus: 'FAILED',
        errorMessage: 'boom',
      });
    });
  });

  describe('updateDocumentTitle', () => {
    it('trims and persists the new title', async () => {
      const doc = buildDocument();
      documentRepository.findOne.mockResolvedValue(doc);
      documentRepository.save.mockImplementation(async (d) => d);

      const result = await service.updateDocumentTitle('doc-1', 'user-1', '  New  ');

      expect(documentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New' }),
      );
      expect(result.title).toBe('New');
    });

    it('rejects title update from a non-owner', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ ownerUserId: 'other' }),
      );

      await expect(
        service.updateDocumentTitle('doc-1', 'user-1', 'New'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(documentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteDocument', () => {
    it('deletes the row, removes the file, and clears the output dir', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      documentRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteDocument('doc-1', 'user-1');

      expect(documentRepository.delete).toHaveBeenCalledWith({ id: 'doc-1' });
      expect(documentFileStorageService.deleteIfLocal).toHaveBeenCalledWith(
        '/uploads/documents/abc.pdf',
      );
      expect(fsPromisesMock.rm).toHaveBeenCalledWith('/tmp/out', {
        recursive: true,
        force: true,
      });
      expect(result).toEqual({ success: true });
    });

    it('skips output dir removal when none is set', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ outputDir: null }),
      );
      documentRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteDocument('doc-1', 'user-1');

      expect(fsPromisesMock.rm).not.toHaveBeenCalled();
    });

    it('throws NotFound when deleting a missing document', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteDocument('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(documentRepository.delete).not.toHaveBeenCalled();
    });

    it('denies delete to a non-owner', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ ownerUserId: 'other' }),
      );

      await expect(service.deleteDocument('doc-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(documentRepository.delete).not.toHaveBeenCalled();
    });
  });
});
