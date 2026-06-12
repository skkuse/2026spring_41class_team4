import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeywordsService } from '../keywords/keywords.service';
import { SubjectsService } from '../subjects/subjects.service';
import { DocumentAnalysisAiService } from './document-analysis-ai.service';
import { DocumentFileStorageService } from './document-file-storage.service';
import { DocumentPreprocessingService, ParsedDocumentChunk } from './document-preprocessing.service';
import { DocumentChunkEntity } from './entities/document-chunk.entity';
import { DocumentEntity } from './entities/document.entity';
import { ParsedDocumentArtifacts, PdfParserService } from './pdf-parser.service';

export interface UploadDocumentResponse {
  documentId: string;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  canAnalyze: boolean;
}

export interface AnalyzeDocumentResponse {
  documentId: string;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  overallSummary: string;
  keywordCount: number;
  keywords: Array<{
    id: string;
    name: string;
    importanceScore: number;
  }>;
}

export interface DocumentDetailResponse {
  documentId: string;
  subjectId?: string | null;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  overallSummary?: string | null;
  keywords: Array<{
    id: string;
    name: string;
    importanceScore: number;
  }>;
}

export interface DocumentStatusResponse {
  documentId: string;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  errorMessage?: string | null;
}

export interface DocumentMetadataResponse {
  documentId: string;
  subjectId?: string | null;
  title?: string | null;
  originalFileName?: string | null;
  fileUrl: string;
  pageCount: number;
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

// Upload failures caused by the *content* of the uploaded file -> 400.
// Anything else (e.g. the pdf parser's java runtime missing on the host)
// is an infrastructure problem and must stay a visible 500.
const UPLOAD_INPUT_FAILURE_PATTERNS = [
  'No preprocessed document text available',
  'No page-level document chunks could be parsed',
];

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(DocumentChunkEntity)
    private readonly documentChunkRepository: Repository<DocumentChunkEntity>,
    private readonly subjectsService: SubjectsService,
    private readonly keywordsService: KeywordsService,
    private readonly pdfParserService: PdfParserService,
    private readonly documentFileStorageService: DocumentFileStorageService,
    private readonly documentPreprocessingService: DocumentPreprocessingService,
    private readonly documentAnalysisAiService: DocumentAnalysisAiService,
  ) {}

  async uploadToSubject(
    subjectId: string,
    file: Express.Multer.File,
    ownerUserId: string,
    title?: string,
  ): Promise<UploadDocumentResponse> {
    await this.subjectsService.findOne(ownerUserId, subjectId);

    const storedFile = await this.documentFileStorageService.savePdf(file);
    let document: DocumentEntity | null = null;
    try {
      const parsed = await this.pdfParserService.parse(file);

      document = await this.persistParsedDocument({
        parsed,
        ownerUserId,
        subjectId,
        title,
        originalFileName: storedFile.originalFileName,
        fileUrl: storedFile.fileUrl,
      });
      await this.replaceDocumentChunksFromCleanedMarkdown(document);
    } catch (error) {
      // Compensate so a failed upload leaves no orphan row, stored file, or parser output.
      await this.cleanupFailedUpload(storedFile.fileUrl, document);
      // Keep the original diagnostic visible (e.g. "spawn java ENOENT" on
      // hosts missing the pdf parser's JDK requirement).
      this.logger.error(
        'Document upload processing failed; partial artifacts cleaned up.',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : '';
      if (
        UPLOAD_INPUT_FAILURE_PATTERNS.some((pattern) =>
          message.includes(pattern),
        )
      ) {
        throw new BadRequestException(
          'Uploaded file could not be processed as a PDF document.',
        );
      }
      // Unknown failure: infra/runtime problem, not the user's file.
      throw error;
    }

    return {
      documentId: document.id,
      fileUrl: document.fileUrl ?? '',
      pageCount: document.pageCount,
      analysisStatus: document.analysisStatus,
      canAnalyze: true,
    };
  }

  private async cleanupFailedUpload(
    fileUrl: string | null,
    document: DocumentEntity | null,
  ): Promise<void> {
    // Cleanup failures must not mask the original upload error.
    if (document) {
      try {
        await this.documentRepository.delete({ id: document.id });
      } catch {
        // ignore
      }
      if (document.outputDir) {
        try {
          await rm(document.outputDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }
    try {
      await this.documentFileStorageService.deleteIfLocal(fileUrl);
    } catch {
      // ignore
    }
  }

  async listSubjectDocuments(
    subjectId: string,
    userId: string,
  ): Promise<DocumentMetadataResponse[]> {
    await this.subjectsService.findOne(userId, subjectId);
    const documents = await this.documentRepository.find({
      where: {
        subjectId,
        ownerUserId: userId,
      },
      order: { createdAt: 'DESC' },
    });

    return documents.map((document) => this.toDocumentMetadata(document));
  }

  async analyzeDocument(
    documentId: string,
    userId: string,
  ): Promise<AnalyzeDocumentResponse> {
    const document = await this.getOwnedDocumentOrThrow(documentId, userId);

    await this.documentRepository.update(
      { id: document.id },
      {
        analysisStatus: 'PROCESSING',
        analysisErrorMessage: null,
      },
    );

    try {
      const openAiInput = await this.loadOpenAiInput(document);
      const documentChunks = await this.documentChunkRepository.find({
        where: { documentId: document.id },
        order: { displayOrder: 'ASC' },
      });
      if (documentChunks.length === 0) {
        throw new Error('No document_chunks found. Upload preprocessing must complete first.');
      }

      const analysis = await this.documentAnalysisAiService.analyzeDocument({
        cleanedMarkdown: openAiInput,
        chunks: documentChunks.map((chunk) => ({
          pageNumber: chunk.pageNumber,
          heading: chunk.heading ?? null,
          content: chunk.content,
          visualNote: chunk.visualNote ?? null,
        })),
      });

      const keywordRows = await this.keywordsService.upsertKeywordsForDocument(
        document,
        documentChunks,
        analysis.keywords,
      );

      await this.documentRepository.update(
        { id: document.id },
        {
          overallSummary: analysis.overallSummary,
          analysisStatus: 'ANALYZED',
          analysisErrorMessage: null,
        },
      );

      return {
        documentId: document.id,
        analysisStatus: 'ANALYZED',
        overallSummary: analysis.overallSummary,
        keywordCount: keywordRows.length,
        keywords: keywordRows.map((row) => ({
          id: row.id,
          name: row.name,
          importanceScore: row.importanceScore ?? 0.5,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.documentRepository.update(
        { id: document.id },
        {
          analysisStatus: 'FAILED',
          analysisErrorMessage: message,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getDocumentDetail(
    documentId: string,
    userId: string,
  ): Promise<DocumentDetailResponse> {
    const document = await this.getOwnedDocumentOrThrow(documentId, userId);
    const keywords = await this.keywordsService.getDocumentKeywords(document.id, userId);

    return {
      documentId: document.id,
      subjectId: document.subjectId,
      fileUrl: document.fileUrl ?? '',
      pageCount: document.pageCount,
      analysisStatus: document.analysisStatus,
      overallSummary: document.overallSummary ?? null,
      keywords: keywords.map((keyword) => ({
        id: keyword.id,
        name: keyword.name,
        importanceScore: keyword.importanceScore ?? 0.5,
      })),
    };
  }

  async getDocumentStatus(
    documentId: string,
    userId: string,
  ): Promise<DocumentStatusResponse> {
    const document = await this.getOwnedDocumentOrThrow(documentId, userId);

    return {
      documentId: document.id,
      analysisStatus: document.analysisStatus,
      errorMessage: document.analysisErrorMessage ?? null,
    };
  }

  async updateDocumentTitle(
    documentId: string,
    userId: string,
    title: string,
  ): Promise<DocumentMetadataResponse> {
    const document = await this.getOwnedDocumentOrThrow(documentId, userId);
    document.title = title.trim();
    const saved = await this.documentRepository.save(document);
    return this.toDocumentMetadata(saved);
  }

  async deleteDocument(
    documentId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const document = await this.getOwnedDocumentOrThrow(documentId, userId);

    await this.documentRepository.delete({ id: document.id });

    await this.documentFileStorageService.deleteIfLocal(document.fileUrl);
    if (document.outputDir) {
      await rm(document.outputDir, { recursive: true, force: true });
    }

    return { success: true };
  }

  private async persistParsedDocument(input: {
    parsed: ParsedDocumentArtifacts;
    ownerUserId: string;
    subjectId: string | null;
    title?: string;
    originalFileName: string | null;
    fileUrl: string | null;
  }): Promise<DocumentEntity> {
    const { parsed, ownerUserId, subjectId, title, originalFileName, fileUrl } = input;
    const normalizedTitle = title?.trim();

    return this.documentRepository.save(
      this.documentRepository.create({
        id: parsed.documentId,
        ownerUserId,
        subjectId,
        title:
          normalizedTitle && normalizedTitle.length > 0
            ? normalizedTitle
            : this.deriveInitialTitle(originalFileName),
        originalFileName,
        fileUrl,
        outputDir: parsed.outputDir,
        jsonFiles: parsed.jsonFiles,
        markdownFiles: parsed.markdownFiles,
        imageFiles: parsed.imageFiles,
        analysisStatus: 'UPLOADED',
        generationStatus: 'uploaded',
        totalPages: parsed.totalPages ?? 0,
        pageCount: parsed.totalPages ?? 0,
        processedPages: 0,
        failedPages: 0,
      }),
    );
  }

  private async getOwnedDocumentOrThrow(
    documentId: string,
    userId: string,
  ): Promise<DocumentEntity> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    if (document.ownerUserId !== userId) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    return document;
  }

  private async loadOpenAiInput(document: DocumentEntity): Promise<string> {
    if (document.outputDir) {
      const cleanedOpenAiPath = join(document.outputDir, 'cleaned-openai-input.md');
      try {
        const content = await readFile(cleanedOpenAiPath, 'utf8');
        if (content.trim()) {
          return content;
        }
      } catch {
        // Fall back to merged markdown files below.
      }
    }

    const markdownTexts = await Promise.all(
      (document.markdownFiles ?? []).map(async (path) => {
        try {
          return await readFile(path, 'utf8');
        } catch {
          return '';
        }
      }),
    );

    const merged = markdownTexts
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .join('\n\n');

    if (merged) {
      return merged;
    }

    throw new Error('No preprocessed document text available for analysis.');
  }

  private toDocumentMetadata(document: DocumentEntity): DocumentMetadataResponse {
    return {
      documentId: document.id,
      subjectId: document.subjectId,
      title: document.title ?? null,
      originalFileName: document.originalFileName ?? null,
      fileUrl: document.fileUrl ?? '',
      pageCount: document.pageCount,
      analysisStatus: document.analysisStatus,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private deriveInitialTitle(originalFileName?: string | null): string | null {
    if (!originalFileName) {
      return null;
    }
    const trimmed = originalFileName.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.replace(/\.[^.]+$/, '');
  }

  private async replaceDocumentChunks(
    documentId: string,
    chunks: ParsedDocumentChunk[],
  ): Promise<DocumentChunkEntity[]> {
    return this.documentChunkRepository.manager.transaction(async (manager) => {
      await manager.delete(DocumentChunkEntity, { documentId });

      if (chunks.length === 0) {
        return [];
      }

      const chunkEntities = chunks.map((chunk) =>
        manager.create(DocumentChunkEntity, {
          documentId,
          pageNumber: chunk.pageNumber,
          heading: chunk.heading,
          content: chunk.content,
          visualNote: chunk.visualNote,
          displayOrder: chunk.displayOrder,
          tokenCount: chunk.tokenCount ?? null,
        }),
      );

      await manager.insert(DocumentChunkEntity, chunkEntities);

      return manager.find(DocumentChunkEntity, {
        where: { documentId },
        order: { displayOrder: 'ASC' },
      });
    });
  }

  private async replaceDocumentChunksFromCleanedMarkdown(
    document: DocumentEntity,
  ): Promise<DocumentChunkEntity[]> {
    const markdown = await this.loadOpenAiInput(document);
    const parsedChunks = this.documentPreprocessingService.parseCleanedMarkdownToChunks(markdown);
    if (parsedChunks.length === 0) {
      throw new Error('No page-level document chunks could be parsed from cleaned markdown.');
    }

    return this.replaceDocumentChunks(document.id, parsedChunks);
  }
}
