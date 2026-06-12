import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { SubjectsService } from '../subjects/subjects.service';
import { KeywordChunkEntity } from './entities/keyword-chunk.entity';
import { Keyword } from './entities/keyword.entity';
import { KeywordsService } from './keywords.service';

type MockRepo<T> = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
};

function createMockRepo<T>(): MockRepo<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value: unknown) => value),
    insert: jest.fn(),
    delete: jest.fn(),
  };
}

describe('KeywordsService', () => {
  let service: KeywordsService;
  let keywordRepository: MockRepo<Keyword>;
  let keywordChunkRepository: MockRepo<KeywordChunkEntity>;
  let documentRepository: MockRepo<DocumentEntity>;
  let documentChunkRepository: MockRepo<DocumentChunkEntity>;
  let subjectsService: { findOne: jest.Mock };

  beforeEach(() => {
    keywordRepository = createMockRepo<Keyword>();
    keywordChunkRepository = createMockRepo<KeywordChunkEntity>();
    documentRepository = createMockRepo<DocumentEntity>();
    documentChunkRepository = createMockRepo<DocumentChunkEntity>();
    subjectsService = { findOne: jest.fn() };

    service = new KeywordsService(
      keywordRepository as never,
      keywordChunkRepository as never,
      documentRepository as never,
      documentChunkRepository as never,
      subjectsService as unknown as SubjectsService,
    );
  });

  it('maps sourceRefs to document_chunks and avoids duplicate keyword_chunks', async () => {
    const document = {
      id: 'doc-1',
    } as DocumentEntity;
    const documentChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        heading: 'Intro',
      },
    ] as DocumentChunkEntity[];

    keywordRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'keyword-1',
          documentId: 'doc-1',
          name: 'Software Engineering',
          description: 'desc',
          importanceScore: 0.9,
          isLearningObjectiveCore: true,
          appearsMultipleTimes: true,
          isPrerequisiteForOtherConcepts: false,
          isUsedInAssessment: false,
        },
      ]);
    keywordRepository.save.mockResolvedValue(undefined);
    keywordChunkRepository.delete.mockResolvedValue(undefined);
    keywordChunkRepository.insert.mockResolvedValue(undefined);

    await service.upsertKeywordsForDocument(document, documentChunks, [
      {
        name: 'Software Engineering',
        description: 'desc',
        importanceScore: 0.9,
        sourceRefs: [
          {
            pageNumber: 1,
            heading: 'Intro',
            evidenceText: 'evidence',
            relevanceScore: 0.95,
          },
          {
            pageNumber: 1,
            heading: 'Intro',
            evidenceText: 'duplicate evidence',
            relevanceScore: 0.9,
          },
          {
            pageNumber: 99,
            heading: 'Missing',
            evidenceText: 'should be skipped',
            relevanceScore: 0.5,
          },
        ],
        isLearningObjectiveCore: true,
        appearsMultipleTimes: true,
      },
    ]);

    expect(keywordChunkRepository.delete).toHaveBeenCalledWith({
      keywordId: 'keyword-1',
    });
    expect(keywordChunkRepository.insert).toHaveBeenCalledTimes(1);
    const insertedRows = keywordChunkRepository.insert.mock.calls[0][0] as Array<{
      keywordId: string;
      documentChunkId: string;
    }>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      keywordId: 'keyword-1',
      documentChunkId: 'chunk-1',
    });
  });

  it('includes sourceRefs in getDocumentKeywords response', async () => {
    documentRepository.findOne.mockResolvedValue({
      id: 'doc-1',
      ownerUserId: 'user-1',
      subjectId: 'sub-1',
      title: 'Doc Title',
    });
    subjectsService.findOne.mockResolvedValue(undefined);
    keywordRepository.find.mockResolvedValue([
      {
        id: 'keyword-1',
        documentId: 'doc-1',
        name: 'Software Engineering',
        description: 'desc',
        importanceScore: 0.8,
        isLearningObjectiveCore: true,
        appearsMultipleTimes: false,
        isPrerequisiteForOtherConcepts: false,
        isUsedInAssessment: false,
      },
    ]);
    keywordChunkRepository.find.mockResolvedValue([
      {
        keywordId: 'keyword-1',
        evidenceText: 'evidence',
        relevanceScore: 0.95,
        documentChunk: {
          id: 'chunk-1',
          pageNumber: 6,
          heading: 'Software Engineering',
        },
      },
    ]);

    const result = await service.getDocumentKeywords('doc-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].sourceRefs).toEqual([
      {
        chunkId: 'chunk-1',
        pageNumber: 6,
        heading: 'Software Engineering',
        evidenceText: 'evidence',
        relevanceScore: 0.95,
      },
    ]);
  });
});
