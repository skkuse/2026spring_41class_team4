import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { DocumentKeywordSourceRef } from '../document/document-analysis-ai.service';
import { SubjectsService } from '../subjects/subjects.service';
import { KeywordResponseDto, KeywordSourceRefDto } from './dto/keyword-response.dto';
import { KeywordChunkEntity } from './entities/keyword-chunk.entity';
import { Keyword } from './entities/keyword.entity';

export interface KeywordCandidateInput {
  name: string;
  description?: string;
  importanceScore: number;
  sourceRefs?: DocumentKeywordSourceRef[];
  isLearningObjectiveCore?: boolean;
  appearsMultipleTimes?: boolean;
  isPrerequisiteForOtherConcepts?: boolean;
  isUsedInAssessment?: boolean;
}

@Injectable()
export class KeywordsService {
  constructor(
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(KeywordChunkEntity)
    private readonly keywordChunkRepository: Repository<KeywordChunkEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(DocumentChunkEntity)
    private readonly documentChunkRepository: Repository<DocumentChunkEntity>,
    private readonly subjectsService: SubjectsService,
  ) {}

  async getSubjectKeywords(
    subjectId: string,
    userId: string,
  ): Promise<KeywordResponseDto[]> {
    await this.subjectsService.findOne(userId, subjectId);

    const subjectDocuments = await this.documentRepository.find({
      where: { subjectId, ownerUserId: userId },
      select: ['id', 'subjectId', 'title'],
    });
    if (subjectDocuments.length === 0) {
      return [];
    }

    const byDocumentId = new Map(
      subjectDocuments.map((document) => [document.id, document] as const),
    );

    const keywords = await this.keywordRepository.find({
      where: { documentId: In(subjectDocuments.map((document) => document.id)) },
      order: { importanceScore: 'DESC', name: 'ASC' },
    });

    const sourceRefsByKeywordId = await this.getKeywordSourceRefsMap(
      keywords.map((keyword) => keyword.id),
    );

    return keywords.map((keyword) =>
      this.toKeywordResponse(keyword, {
        subjectId: byDocumentId.get(keyword.documentId)?.subjectId ?? null,
        documentTitle: byDocumentId.get(keyword.documentId)?.title ?? null,
        sourceRefs: sourceRefsByKeywordId.get(keyword.id) ?? [],
      }),
    );
  }

  async getDocumentKeywords(
    documentId: string,
    userId: string,
  ): Promise<KeywordResponseDto[]> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    if (document.ownerUserId !== userId) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    if (document.subjectId) {
      await this.subjectsService.findOne(userId, document.subjectId);
    }

    const keywords = await this.keywordRepository.find({
      where: { documentId: document.id },
      order: { importanceScore: 'DESC', name: 'ASC' },
    });
    const sourceRefsByKeywordId = await this.getKeywordSourceRefsMap(
      keywords.map((keyword) => keyword.id),
    );

    return keywords.map((keyword) =>
      this.toKeywordResponse(keyword, {
        subjectId: document.subjectId ?? null,
        documentTitle: document.title ?? null,
        sourceRefs: sourceRefsByKeywordId.get(keyword.id) ?? [],
      }),
    );
  }

  async upsertKeywordsForDocument(
    document: DocumentEntity,
    documentChunks: DocumentChunkEntity[],
    keywordCandidates: KeywordCandidateInput[],
  ): Promise<Keyword[]> {
    const normalized = keywordCandidates
      .map((keyword) => ({
        name: keyword.name.trim(),
        description:
          typeof keyword.description === 'string' && keyword.description.trim().length > 0
            ? keyword.description.trim()
            : null,
        importanceScore: Math.max(0, Math.min(1, keyword.importanceScore)),
        sourceRefs: this.normalizeSourceRefs(keyword.sourceRefs ?? []),
        isLearningObjectiveCore: keyword.isLearningObjectiveCore === true,
        appearsMultipleTimes: keyword.appearsMultipleTimes === true,
        isPrerequisiteForOtherConcepts:
          keyword.isPrerequisiteForOtherConcepts === true,
        isUsedInAssessment: keyword.isUsedInAssessment === true,
      }))
      .filter((keyword) => keyword.name.length > 0);

    if (normalized.length === 0) {
      return [];
    }

    const uniqueByLower = new Map<
      string,
      {
        name: string;
        description: string | null;
        importanceScore: number;
        sourceRefs: DocumentKeywordSourceRef[];
        isLearningObjectiveCore: boolean;
        appearsMultipleTimes: boolean;
        isPrerequisiteForOtherConcepts: boolean;
        isUsedInAssessment: boolean;
      }
    >();

    for (const item of normalized) {
      const key = item.name.toLowerCase();
      const existing = uniqueByLower.get(key);
      if (!existing) {
        uniqueByLower.set(key, item);
        continue;
      }

      uniqueByLower.set(key, {
        name: existing.name,
        description: item.description ?? existing.description ?? null,
        importanceScore: Math.max(existing.importanceScore, item.importanceScore),
        sourceRefs: this.mergeSourceRefs(existing.sourceRefs, item.sourceRefs),
        isLearningObjectiveCore:
          existing.isLearningObjectiveCore || item.isLearningObjectiveCore,
        appearsMultipleTimes: existing.appearsMultipleTimes || item.appearsMultipleTimes,
        isPrerequisiteForOtherConcepts:
          existing.isPrerequisiteForOtherConcepts ||
          item.isPrerequisiteForOtherConcepts,
        isUsedInAssessment: existing.isUsedInAssessment || item.isUsedInAssessment,
      });
    }
    const uniqueKeywords = [...uniqueByLower.values()];

    const existingKeywords = await this.keywordRepository.find({
      where: {
        documentId: document.id,
        name: In(uniqueKeywords.map((item) => item.name)),
      },
    });

    const byName = new Map(existingKeywords.map((item) => [item.name, item]));
    const keywordsToSave: Keyword[] = [...existingKeywords];

    for (const item of uniqueKeywords) {
      const existing = byName.get(item.name);
      if (existing) {
        existing.description = item.description ?? existing.description ?? null;
        existing.importanceScore = item.importanceScore;
        existing.isLearningObjectiveCore = item.isLearningObjectiveCore;
        existing.appearsMultipleTimes = item.appearsMultipleTimes;
        existing.isPrerequisiteForOtherConcepts = item.isPrerequisiteForOtherConcepts;
        existing.isUsedInAssessment = item.isUsedInAssessment;
        continue;
      }

      keywordsToSave.push(
        this.keywordRepository.create({
          documentId: document.id,
          name: item.name,
          description: item.description,
          importanceScore: item.importanceScore,
          isLearningObjectiveCore: item.isLearningObjectiveCore,
          appearsMultipleTimes: item.appearsMultipleTimes,
          isPrerequisiteForOtherConcepts: item.isPrerequisiteForOtherConcepts,
          isUsedInAssessment: item.isUsedInAssessment,
        }),
      );
    }

    await this.keywordRepository.save(keywordsToSave);

    const savedKeywords = await this.keywordRepository.find({
      where: { documentId: document.id },
      order: { importanceScore: 'DESC', name: 'ASC' },
    });
    const savedKeywordsByName = new Map(savedKeywords.map((keyword) => [keyword.name, keyword]));
    const chunkByPageNumber = new Map(documentChunks.map((chunk) => [chunk.pageNumber, chunk]));

    await Promise.all(
      uniqueKeywords.map(async (keyword) => {
        const savedKeyword = savedKeywordsByName.get(keyword.name);
        if (!savedKeyword) {
          return;
        }

        await this.keywordChunkRepository.delete({ keywordId: savedKeyword.id });

        const mappedChunks: KeywordChunkEntity[] = [];
        const visitedChunkIds = new Set<string>();
        for (const sourceRef of keyword.sourceRefs) {
          const documentChunk = chunkByPageNumber.get(sourceRef.pageNumber);
          if (!documentChunk || visitedChunkIds.has(documentChunk.id)) {
            continue;
          }
          visitedChunkIds.add(documentChunk.id);

          mappedChunks.push(
            this.keywordChunkRepository.create({
              keywordId: savedKeyword.id,
              documentChunkId: documentChunk.id,
              evidenceText: sourceRef.evidenceText?.trim() || null,
              relevanceScore:
                sourceRef.relevanceScore === undefined
                  ? null
                  : Math.max(0, Math.min(1, sourceRef.relevanceScore)),
            }),
          );
        }

        if (mappedChunks.length > 0) {
          await this.keywordChunkRepository.insert(mappedChunks);
        }
      }),
    );

    return savedKeywords;
  }

  private normalizeSourceRefs(sourceRefs: DocumentKeywordSourceRef[]): DocumentKeywordSourceRef[] {
    return sourceRefs
      .map((sourceRef) => ({
        pageNumber: this.normalizePageNumber(sourceRef.pageNumber),
        heading:
          typeof sourceRef.heading === 'string' && sourceRef.heading.trim().length > 0
            ? sourceRef.heading.trim()
            : null,
        evidenceText:
          typeof sourceRef.evidenceText === 'string' &&
          sourceRef.evidenceText.trim().length > 0
            ? sourceRef.evidenceText.trim()
            : undefined,
        relevanceScore:
          sourceRef.relevanceScore === undefined || sourceRef.relevanceScore === null
            ? undefined
            : Math.max(0, Math.min(1, sourceRef.relevanceScore)),
      }))
      .filter((sourceRef) => sourceRef.pageNumber > 0);
  }

  private normalizePageNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 0;
  }

  private mergeSourceRefs(
    left: DocumentKeywordSourceRef[],
    right: DocumentKeywordSourceRef[],
  ): DocumentKeywordSourceRef[] {
    const merged = new Map<number, DocumentKeywordSourceRef>();
    for (const sourceRef of [...left, ...right]) {
      const existing = merged.get(sourceRef.pageNumber);
      if (!existing) {
        merged.set(sourceRef.pageNumber, sourceRef);
        continue;
      }

      merged.set(sourceRef.pageNumber, {
        pageNumber: sourceRef.pageNumber,
        heading: sourceRef.heading ?? existing.heading ?? null,
        evidenceText: sourceRef.evidenceText ?? existing.evidenceText,
        relevanceScore: Math.max(
          sourceRef.relevanceScore ?? 0,
          existing.relevanceScore ?? 0,
        ),
      });
    }
    return [...merged.values()];
  }

  private async getKeywordSourceRefsMap(
    keywordIds: string[],
  ): Promise<Map<string, KeywordSourceRefDto[]>> {
    if (keywordIds.length === 0) {
      return new Map();
    }

    const keywordChunks = await this.keywordChunkRepository.find({
      where: { keywordId: In(keywordIds) },
      relations: { documentChunk: true },
      order: { createdAt: 'ASC' },
    });

    const result = new Map<string, KeywordSourceRefDto[]>();
    for (const keywordChunk of keywordChunks) {
      if (!keywordChunk.documentChunk) {
        continue;
      }

      const refs = result.get(keywordChunk.keywordId) ?? [];
      refs.push({
        chunkId: keywordChunk.documentChunk.id,
        pageNumber: keywordChunk.documentChunk.pageNumber,
        heading: keywordChunk.documentChunk.heading ?? null,
        evidenceText: keywordChunk.evidenceText ?? null,
        relevanceScore: keywordChunk.relevanceScore ?? null,
      });
      result.set(keywordChunk.keywordId, refs);
    }

    return result;
  }

  private toKeywordResponse(
    keyword: Keyword,
    context?: {
      subjectId?: string | null;
      documentTitle?: string | null;
      sourceRefs?: KeywordSourceRefDto[];
    },
  ): KeywordResponseDto {
    return {
      id: keyword.id,
      documentId: keyword.documentId,
      subjectId: context?.subjectId ?? null,
      documentTitle: context?.documentTitle ?? null,
      name: keyword.name,
      description: keyword.description ?? null,
      importanceScore: keyword.importanceScore ?? null,
      isLearningObjectiveCore: keyword.isLearningObjectiveCore,
      appearsMultipleTimes: keyword.appearsMultipleTimes,
      isPrerequisiteForOtherConcepts: keyword.isPrerequisiteForOtherConcepts,
      isUsedInAssessment: keyword.isUsedInAssessment,
      sourceRefs: context?.sourceRefs ?? [],
    };
  }
}
