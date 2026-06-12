import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizGenerationTargetPlan, QuizKeywordTarget, QuizSourceChunk } from './dto/quiz-generation-target-plan.dto';
import { DifficultyLevel } from './enums/difficulty-level.enum';

const MIN_ATTEMPTS_PER_KEYWORD = 3;

export interface SelectLectureQuizTargetsInput {
  userId: string;
  documentId: string;
  quizProblemCount: number;
  keywordIds?: string[];
  difficulty?: DifficultyLevel | null;
}

interface ScoredKeywordCandidate {
  keyword: Keyword;
  masteryScore: number | null;
  attempts: number;
  importanceScore: number;
  masteryGapScore: number;
  coverageDeficitScore: number;
  priorityScore: number;
}

@Injectable()
export class QuizTargetSelectorService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(MasteryScore)
    private readonly masteryScoreRepository: Repository<MasteryScore>,
    @InjectRepository(KeywordChunkEntity)
    private readonly keywordChunkRepository: Repository<KeywordChunkEntity>,
    @InjectRepository(DocumentChunkEntity)
    private readonly documentChunkRepository: Repository<DocumentChunkEntity>,
  ) {}

  async selectLectureQuizTargets(
    input: SelectLectureQuizTargetsInput,
  ): Promise<QuizGenerationTargetPlan> {
    if (!Number.isInteger(input.quizProblemCount) || input.quizProblemCount <= 0) {
      throw new BadRequestException('quizProblemCount must be a positive integer.');
    }

    const document = await this.documentRepository.findOne({
      where: { id: input.documentId },
      select: ['id', 'ownerUserId', 'subjectId', 'analysisStatus'],
    });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    if (document.ownerUserId !== input.userId) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    if (document.analysisStatus !== 'ANALYZED') {
      throw new BadRequestException(
        'Document must be ANALYZED before selecting quiz targets.',
      );
    }
    if (!document.subjectId) {
      throw new BadRequestException(
        'Document is missing subject context required for quiz target planning.',
      );
    }

    const documentKeywords = await this.keywordRepository.find({
      where: { documentId: document.id },
      order: { importanceScore: 'DESC', name: 'ASC' },
    });
    if (documentKeywords.length === 0) {
      throw new BadRequestException('No keywords found for this document.');
    }

    const keywordIds = input.keywordIds?.filter((keywordId) => keywordId.trim().length > 0) ?? [];
    const useExplicitKeywords = keywordIds.length > 0;
    const keywordById = new Map(documentKeywords.map((keyword) => [keyword.id, keyword]));
    if (useExplicitKeywords) {
      const invalidKeywordIds = keywordIds.filter((keywordId) => !keywordById.has(keywordId));
      if (invalidKeywordIds.length > 0) {
        throw new BadRequestException(
          'All selected keywordIds must belong to the target document.',
        );
      }
    }

    const candidateKeywords = useExplicitKeywords
      ? keywordIds.map((keywordId) => keywordById.get(keywordId)!).filter(Boolean)
      : documentKeywords;

    const masteryRows = await this.masteryScoreRepository.find({
      where: {
        userId: input.userId,
        keywordId: In(candidateKeywords.map((keyword) => keyword.id)),
      },
    });
    const masteryByKeywordId = new Map(
      masteryRows.map((masteryRow) => [masteryRow.keywordId, masteryRow]),
    );

    const scoredCandidates = candidateKeywords.map((keyword) => {
      const mastery = masteryByKeywordId.get(keyword.id);
      const masteryScore = mastery ? Number(mastery.masteryScore) : null;
      const attempts = mastery?.attempts ?? 0;
      const importanceScore = keyword.importanceScore == null ? 0.5 : Number(keyword.importanceScore);
      const coverageDeficitScore =
        1 - Math.min(attempts, MIN_ATTEMPTS_PER_KEYWORD) / MIN_ATTEMPTS_PER_KEYWORD;
      const masteryGapScore = masteryScore == null ? 0.6 : 1 - masteryScore;
      const priorityScore =
        0.5 * coverageDeficitScore + 0.3 * importanceScore + 0.2 * masteryGapScore;

      return {
        keyword,
        masteryScore,
        attempts,
        importanceScore,
        masteryGapScore,
        coverageDeficitScore,
        priorityScore,
      } satisfies ScoredKeywordCandidate;
    });

    scoredCandidates.sort((left, right) => {
      const leftNeedsCoverage = left.attempts < MIN_ATTEMPTS_PER_KEYWORD ? 1 : 0;
      const rightNeedsCoverage = right.attempts < MIN_ATTEMPTS_PER_KEYWORD ? 1 : 0;
      if (leftNeedsCoverage !== rightNeedsCoverage) {
        return rightNeedsCoverage - leftNeedsCoverage;
      }
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      if (right.importanceScore !== left.importanceScore) {
        return right.importanceScore - left.importanceScore;
      }
      return right.masteryGapScore - left.masteryGapScore;
    });

    const keywordChunks = await this.keywordChunkRepository.find({
      where: { keywordId: In(scoredCandidates.map((candidate) => candidate.keyword.id)) },
      relations: { documentChunk: true },
      order: { createdAt: 'ASC' },
    });

    const keywordSourceChunkIds = new Map<string, string[]>();
    const sourceChunkById = new Map<string, QuizSourceChunk>();

    for (const keywordChunk of keywordChunks) {
      if (!keywordChunk.documentChunk) {
        continue;
      }

      const sourceChunkId = keywordChunk.documentChunk.id;
      const existingChunk = sourceChunkById.get(sourceChunkId);
      const currentRelevance = keywordChunk.relevanceScore == null
        ? null
        : Number(keywordChunk.relevanceScore);

      if (!existingChunk) {
        sourceChunkById.set(sourceChunkId, {
          chunkId: sourceChunkId,
          pageNumber: keywordChunk.documentChunk.pageNumber,
          heading: keywordChunk.documentChunk.heading ?? null,
          content: keywordChunk.documentChunk.content,
          evidenceText: keywordChunk.evidenceText ?? null,
          relevanceScore: currentRelevance,
        });
      } else {
        const existingRelevance =
          existingChunk.relevanceScore == null ? Number.NEGATIVE_INFINITY : existingChunk.relevanceScore;
        const nextRelevance =
          currentRelevance == null ? Number.NEGATIVE_INFINITY : currentRelevance;
        if (nextRelevance > existingRelevance) {
          existingChunk.evidenceText = keywordChunk.evidenceText ?? existingChunk.evidenceText ?? null;
          existingChunk.relevanceScore = currentRelevance;
        }
      }

      const sourceIds = keywordSourceChunkIds.get(keywordChunk.keywordId) ?? [];
      if (!sourceIds.includes(sourceChunkId)) {
        sourceIds.push(sourceChunkId);
      }
      keywordSourceChunkIds.set(keywordChunk.keywordId, sourceIds);
    }

    const selectedCandidates = scoredCandidates.filter((candidate) => {
      const sourceIds = keywordSourceChunkIds.get(candidate.keyword.id);
      return Array.isArray(sourceIds) && sourceIds.length > 0;
    });

    let effectiveCandidates = selectedCandidates;
    let fallbackSourceChunkIds: string[] = [];
    if (effectiveCandidates.length === 0) {
      const fallbackChunks = await this.documentChunkRepository.find({
        where: { documentId: document.id },
        order: { pageNumber: 'ASC', displayOrder: 'ASC' },
      });
      if (fallbackChunks.length === 0) {
        throw new BadRequestException(
          'No document chunks found for the target document.',
        );
      }

      for (const chunk of fallbackChunks) {
        sourceChunkById.set(chunk.id, {
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          heading: chunk.heading ?? null,
          content: chunk.content,
          evidenceText: null,
          relevanceScore: null,
        });
      }
      fallbackSourceChunkIds = fallbackChunks.map((chunk) => chunk.id);
      effectiveCandidates = scoredCandidates;
    }

    const desiredQuestionCountByKeywordId = new Map<string, number>(
      effectiveCandidates.map((candidate) => [candidate.keyword.id, 0]),
    );
    let remaining = input.quizProblemCount;
    while (remaining > 0) {
      for (const candidate of effectiveCandidates) {
        if (remaining === 0) {
          break;
        }
        const current = desiredQuestionCountByKeywordId.get(candidate.keyword.id) ?? 0;
        desiredQuestionCountByKeywordId.set(candidate.keyword.id, current + 1);
        remaining -= 1;
      }
    }

    const targets: QuizKeywordTarget[] = effectiveCandidates
      .map((candidate) => ({
        keywordId: candidate.keyword.id,
        name: candidate.keyword.name,
        description: candidate.keyword.description ?? null,
        importanceScore: candidate.importanceScore,
        masteryScore: candidate.masteryScore,
        attempts: candidate.attempts,
        priorityScore: candidate.priorityScore,
        desiredQuestionCount:
          desiredQuestionCountByKeywordId.get(candidate.keyword.id) ?? 0,
        sourceChunkIds:
          keywordSourceChunkIds.get(candidate.keyword.id) ?? [...fallbackSourceChunkIds],
      }))
      .filter((target) => target.desiredQuestionCount > 0);

    const difficultyDistribution = this.resolveDifficultyDistribution(
      input.quizProblemCount,
      input.difficulty ?? null,
      selectedCandidates.map((candidate) => candidate.masteryScore),
    );

    const referencedChunkIds = new Set<string>();
    for (const target of targets) {
      for (const sourceChunkId of target.sourceChunkIds) {
        referencedChunkIds.add(sourceChunkId);
      }
    }

    const sourceChunks = await this.loadSourceChunksByIds(
      [...referencedChunkIds],
      sourceChunkById,
    );
    const availableChunkIdSet = new Set(sourceChunks.map((chunk) => chunk.chunkId));
    const normalizedTargets = targets
      .map((target) => ({
        ...target,
        sourceChunkIds: target.sourceChunkIds.filter((chunkId) => availableChunkIdSet.has(chunkId)),
      }))
      .filter((target) => target.sourceChunkIds.length > 0);
    const finalizedTargets = this.rebalanceDesiredQuestionCounts(
      normalizedTargets,
      input.quizProblemCount,
    );

    return {
      documentId: document.id,
      subjectId: document.subjectId,
      userId: input.userId,
      quizProblemCount: input.quizProblemCount,
      difficultyDistribution,
      targets: finalizedTargets,
      sourceChunks,
    };
  }

  private resolveDifficultyDistribution(
    quizProblemCount: number,
    requestedDifficulty: DifficultyLevel | null,
    masteryScores: Array<number | null>,
  ): {
    easyCount: number;
    mediumCount: number;
    hardCount: number;
  } {
    if (requestedDifficulty === DifficultyLevel.EASY) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.7,
        medium: 0.3,
        hard: 0,
      });
    }

    if (requestedDifficulty === DifficultyLevel.MEDIUM) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.2,
        medium: 0.6,
        hard: 0.2,
      });
    }

    if (requestedDifficulty === DifficultyLevel.HARD) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.1,
        medium: 0.35,
        hard: 0.55,
      });
    }

    const knownMastery = masteryScores.filter(
      (score): score is number => score !== null && Number.isFinite(score),
    );
    if (knownMastery.length === 0) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.4,
        medium: 0.5,
        hard: 0.1,
      });
    }

    const averageMastery =
      knownMastery.reduce((sum, score) => sum + score, 0) / knownMastery.length;

    if (averageMastery < 0.4) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.6,
        medium: 0.3,
        hard: 0.1,
      });
    }

    if (averageMastery < 0.7) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.4,
        medium: 0.4,
        hard: 0.2,
      });
    }

    return this.allocateDifficultyCounts(quizProblemCount, {
      easy: 0.2,
      medium: 0.5,
      hard: 0.3,
    });
  }

  private allocateDifficultyCounts(
    quizProblemCount: number,
    ratios: { easy: number; medium: number; hard: number },
  ): { easyCount: number; mediumCount: number; hardCount: number } {
    const raw = {
      easy: quizProblemCount * ratios.easy,
      medium: quizProblemCount * ratios.medium,
      hard: quizProblemCount * ratios.hard,
    };

    const base = {
      easy: Math.floor(raw.easy),
      medium: Math.floor(raw.medium),
      hard: Math.floor(raw.hard),
    };

    let remaining =
      quizProblemCount - (base.easy + base.medium + base.hard);

    const order = [
      { key: 'easy' as const, frac: raw.easy - base.easy },
      { key: 'medium' as const, frac: raw.medium - base.medium },
      { key: 'hard' as const, frac: raw.hard - base.hard },
    ].sort((left, right) => {
      if (right.frac !== left.frac) {
        return right.frac - left.frac;
      }
      // Stable deterministic tie-break to avoid randomness.
      const priority = { medium: 0, easy: 1, hard: 2 } as const;
      return priority[left.key] - priority[right.key];
    });

    let cursor = 0;
    while (remaining > 0) {
      const target = order[cursor % order.length].key;
      base[target] += 1;
      remaining -= 1;
      cursor += 1;
    }

    return {
      easyCount: base.easy,
      mediumCount: base.medium,
      hardCount: base.hard,
    };
  }

  private async loadSourceChunksByIds(
    chunkIds: string[],
    fallbackChunkById: Map<string, QuizSourceChunk>,
  ): Promise<QuizSourceChunk[]> {
    if (chunkIds.length === 0) {
      return [];
    }

    const chunkRows = await this.documentChunkRepository.find({
      where: { id: In(chunkIds) },
      order: { pageNumber: 'ASC', displayOrder: 'ASC' },
    });

    const byId = new Map(
      chunkRows.map((chunkRow) => [
        chunkRow.id,
        {
          chunkId: chunkRow.id,
          pageNumber: chunkRow.pageNumber,
          heading: chunkRow.heading ?? null,
          content: chunkRow.content,
          evidenceText: fallbackChunkById.get(chunkRow.id)?.evidenceText ?? null,
          relevanceScore: fallbackChunkById.get(chunkRow.id)?.relevanceScore ?? null,
        } satisfies QuizSourceChunk,
      ]),
    );

    const chunks = chunkIds.map((chunkId) => byId.get(chunkId));
    return chunks.filter((chunk): chunk is NonNullable<typeof chunk> => chunk != null);
  }

  private rebalanceDesiredQuestionCounts(
    targets: QuizKeywordTarget[],
    totalQuestionCount: number,
  ): QuizKeywordTarget[] {
    if (targets.length === 0) {
      return targets;
    }

    const rebalancedTargets = targets.map((target) => ({
      ...target,
      desiredQuestionCount: 0,
    }));

    let remaining = totalQuestionCount;
    while (remaining > 0) {
      for (const target of rebalancedTargets) {
        if (remaining === 0) {
          break;
        }
        target.desiredQuestionCount += 1;
        remaining -= 1;
      }
    }

    return rebalancedTargets.filter((target) => target.desiredQuestionCount > 0);
  }
}
