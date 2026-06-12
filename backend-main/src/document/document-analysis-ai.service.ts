import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface DocumentChunkForAnalysis {
  pageNumber: number;
  heading?: string | null;
  content: string;
  visualNote?: string | null;
}

export interface DocumentKeywordSourceRef {
  pageNumber: number;
  heading?: string | null;
  evidenceText?: string;
  relevanceScore?: number;
}

export interface DocumentKeywordCandidate {
  name: string;
  description?: string;
  importanceScore: number;
  sourceRefs: DocumentKeywordSourceRef[];
  isLearningObjectiveCore?: boolean;
  appearsMultipleTimes?: boolean;
  isPrerequisiteForOtherConcepts?: boolean;
  isUsedInAssessment?: boolean;
}

export interface DocumentAnalysisResult {
  overallSummary: string;
  keywords: DocumentKeywordCandidate[];
}

@Injectable()
export class DocumentAnalysisAiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('OPENAI_API_KEY is not configured.');
    }
    this.client = new OpenAI({ apiKey });
    this.model =
      this.configService.get<string>('OPENAI_ANALYSIS_MODEL') ??
      this.configService.get<string>('OPENAI_MODEL') ??
      'gpt-4.1-mini';
  }

  async analyzeDocument(input: {
    cleanedMarkdown: string;
    chunks: DocumentChunkForAnalysis[];
  }): Promise<DocumentAnalysisResult> {
    const overallSummary = await this.extractSummaryFromMarkdown(input.cleanedMarkdown);
    const keywords = await this.extractKeywordsFromChunks(input.chunks);

    return {
      overallSummary,
      keywords,
    };
  }

  private async extractSummaryFromMarkdown(markdown: string): Promise<string> {
    const prompt = [
      'You are an academic assistant focused on lecture learning outcomes.',
      'Read the provided cleaned lecture markdown and return JSON only.',
      'Schema:',
      '{"overallSummary": string}',
      'Rules:',
      '- overallSummary must be a Markdown-formatted lecture note in Korean.',
      '- Do not output a single long paragraph.',
      '- Use a plain academic tone (neutral, concise, non-promotional).',
      '- Keep important lecture terms in English.',
      '- When a natural Korean equivalent exists, use English Term(한국어) format.',
      '- Do not force awkward Korean translations.',
      '- Prefer this structure in overallSummary:',
      '  1) ## 개요',
      '  2) ## 주요 개념',
      '  3) ## 개념 간 구분',
      '  4) ## 정리',
      '- In "## 개요", use 2-4 bullet points.',
      '- In "## 주요 개념", use a Markdown table with columns: 개념 | 설명.',
      '- In "## 개념 간 구분", use a Markdown table with columns: 구분 | 설명 when comparable concepts exist.',
      '- In "## 정리", use short bullet points that connect the concepts.',
      '- Include enough concept-level detail for review, but keep it concise.',
      '- Extract learning concepts suitable for understanding, memorization, quiz generation, and mastery tracking.',
      '- Do not enforce a fixed keyword count. Return as many meaningful learning concepts as needed.',
      '- Prioritize slide titles, section headings, model names, process names, product categories, quality attributes, table row labels, ethics principles, and important bullet items.',
      '- If the lecture contains an original English term, preserve that original English term at the beginning of keyword.name.',
      '- For English source terms with a natural Korean academic/technical equivalent, format keyword.name as: English Term(한국어 용어).',
      '- If there is no natural Korean equivalent, keep keyword.name in English only.',
      '',
      'Cleaned Lecture Markdown Input:',
      markdown,
    ].join('\n');

    const parsed = await this.runJsonCompletion(prompt);
    return typeof parsed.overallSummary === 'string' ? parsed.overallSummary.trim() : '';
  }

  private async extractKeywordsFromChunks(
    chunks: DocumentChunkForAnalysis[],
  ): Promise<DocumentKeywordCandidate[]> {
    const chunkInput = chunks.map((chunk) => ({
      pageNumber: chunk.pageNumber,
      heading: chunk.heading ?? null,
      content: chunk.content,
      visualNote: chunk.visualNote ?? null,
    }));

    const prompt = [
      'You are an academic assistant focused on lecture learning outcomes.',
      'Extract keywords only from the provided document chunks and return JSON only.',
      'Schema:',
      '{"keywords": [{"name": string, "description": string, "importanceScore": number, "sourceRefs": [{"pageNumber": number, "heading": string, "evidenceText": string, "relevanceScore": number}], "isLearningObjectiveCore": boolean, "appearsMultipleTimes": boolean, "isPrerequisiteForOtherConcepts": boolean, "isUsedInAssessment": boolean}]}',
      'Rules:',
      '- Coverage first: capture the full lecture concept space, including both high-level representative concepts and specific sub-concepts.',
      '- Do not stop at only a compact core set if the lecture clearly contains additional meaningful concepts.',
      '- Do not enforce a fixed keyword count. Return as many meaningful learning concepts as needed.',
      '- Prioritize slide titles, section headings, model names, process names, product categories, quality attributes, table row labels, ethics principles, and important bullet items.',
      '- If multiple distinct models are explicitly present, keep them as separate keywords.',
      '- Example split: Waterfall model, Iterative development, Component-based software engineering.',
      '- Do not merge distinct models into one broad parent label like "Software process model".',
      '- Include explicit terms and useful inferred concepts when clearly supported by chunk content.',
      '- Do not aggressively prune to a tiny core set; include secondary but meaningful concepts as well.',
      '- keyword.name should be specific and clear.',
      '- If the lecture contains an original English term, preserve that original English term at the beginning of keyword.name.',
      '- For English source terms with a natural Korean academic/technical equivalent, format keyword.name as: English Term(한국어 용어).',
      '- If there is no natural Korean equivalent, keep keyword.name in English only.',
      '- Never output Korean-only keyword.name when the source lecture term is English.',
      '- Do not replace or remove the original English term.',
      '- Do not force awkward Korean translations. Prefer English-only when Korean translation is awkward or unnatural.',
      '- Keep spacing compact for bilingual names: use English Term(한국어 용어), not English Term (한국어 용어).',
      '- For acronym/system names (e.g., ACM/IEEE Code of Ethics, MHC-PMS), preserve the original term exactly.',
      '- keyword.description should be in Korean when possible and explain the learning meaning of the concept.',
      '- importanceScore and relevanceScore must be between 0 and 1.',
      '- sourceRefs are required for every keyword.',
      '- Each keyword must include at least one sourceRef.',
      '- sourceRefs.pageNumber must match one of provided chunk page numbers.',
      '- evidenceText should be a short excerpt copied or closely derived from chunk content.',
      '- Do not invent unsupported concepts.',
      '',
      'Document Chunks Input (JSON):',
      JSON.stringify(chunkInput),
    ].join('\n');

    const parsed = await this.runJsonCompletion(prompt);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];

    return keywords
      .filter(
        (item): item is {
          name?: unknown;
          description?: unknown;
          importanceScore?: unknown;
          sourceRefs?: unknown;
          isLearningObjectiveCore?: unknown;
          appearsMultipleTimes?: unknown;
          isPrerequisiteForOtherConcepts?: unknown;
          isUsedInAssessment?: unknown;
        } => !!item && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => ({
        name: this.normalizeKeywordName(item.name),
        description:
          typeof item.description === 'string' ? item.description.trim() : undefined,
        importanceScore: this.normalizeScore(item.importanceScore),
        sourceRefs: this.normalizeSourceRefs(item.sourceRefs),
        isLearningObjectiveCore: this.normalizeBoolean(item.isLearningObjectiveCore),
        appearsMultipleTimes: this.normalizeBoolean(item.appearsMultipleTimes),
        isPrerequisiteForOtherConcepts: this.normalizeBoolean(
          item.isPrerequisiteForOtherConcepts,
        ),
        isUsedInAssessment: this.normalizeBoolean(item.isUsedInAssessment),
      }))
      .filter((item) => item.name.length > 0 && item.sourceRefs.length > 0);
  }

  private async runJsonCompletion(prompt: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new ServiceUnavailableException(
        `OpenAI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private normalizeSourceRefs(value: unknown): DocumentKeywordSourceRef[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (item): item is {
          pageNumber?: unknown;
          heading?: unknown;
          evidenceText?: unknown;
          relevanceScore?: unknown;
        } => !!item && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => {
        const pageNumber = this.normalizePageNumber(item.pageNumber);
        const heading = typeof item.heading === 'string' ? item.heading.trim() : null;
        const evidenceText =
          typeof item.evidenceText === 'string' && item.evidenceText.trim().length > 0
            ? item.evidenceText.trim()
            : undefined;
        const relevanceScore = this.normalizeOptionalScore(item.relevanceScore);

        return {
          pageNumber,
          heading: heading && heading.length > 0 ? heading : null,
          evidenceText,
          relevanceScore,
        };
      })
      .filter((item) => item.pageNumber > 0);
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

  private normalizeScore(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(1, value));
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(1, parsed));
      }
    }
    return 0.5;
  }

  private normalizeOptionalScore(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return this.normalizeScore(value);
  }

  private normalizeKeywordName(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s+\(/g, '(')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
  }

  private normalizeBoolean(value: unknown): boolean {
    return value === true;
  }
}
