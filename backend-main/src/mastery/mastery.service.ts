import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { QuizProblemKeyword } from '../quiz/entities/quiz-problem-keyword.entity';
import { QuizProblemEntity } from '../quiz/entities/quiz-problem.entity';
import { QuizEntity } from '../quiz/entities/quiz.entity';
import { DifficultyWeightedAttempt } from '../quiz-attempts/utils/difficulty-weighted-score';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizProblemAttemptEntity } from '../quiz-attempts/entities/quiz-problem-attempt.entity';
import { UpdatedMasteryItemDto } from '../quiz-attempts/dto/submit-answer-response.dto';
import { Subject } from '../subjects/entities/subject.entity';
import {
  DocumentLearningStatusResponseDto,
  RecentQuizAttemptDto,
  SubjectDashboardDocumentDto,
  SubjectDashboardResponseDto,
  SubjectLearningStatusResponseDto,
  SubjectMasteryKeywordDto,
  SubjectMasteryResponseDto,
} from './dto/subject-mastery-response.dto';
import { MasteryScore } from './entities/mastery-score.entity';
import { calculateDifficultyWeightedScore } from '../quiz-attempts/utils/difficulty-weighted-score';

@Injectable()
export class MasteryService {
  constructor(
    @InjectRepository(MasteryScore)
    private readonly masteryScoreRepository: Repository<MasteryScore>,
    @InjectRepository(QuizAttemptEntity)
    private readonly quizAttemptRepository: Repository<QuizAttemptEntity>,
    @InjectRepository(QuizProblemAttemptEntity)
    private readonly quizProblemAttemptRepository: Repository<QuizProblemAttemptEntity>,
    @InjectRepository(QuizProblemKeyword)
    private readonly quizProblemKeywordRepository: Repository<QuizProblemKeyword>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  async updateMasteryForProblemAnswer(input: {
    userId: string;
    quizProblemId: string;
    answeredAt: Date;
  }): Promise<UpdatedMasteryItemDto[]> {
    const keywordMappings = await this.quizProblemKeywordRepository.find({
      where: { quizProblemId: input.quizProblemId },
    });
    const keywordIds = [
      ...new Set(keywordMappings.map((mapping) => mapping.keywordId)),
    ];

    const updates: UpdatedMasteryItemDto[] = [];
    for (const keywordId of keywordIds) {
      const masteryScore = await this.recalculateKeywordMastery({
        userId: input.userId,
        keywordId,
        answeredAt: input.answeredAt,
      });
      updates.push({
        keywordId,
        masteryScore: Number(masteryScore.masteryScore.toFixed(4)),
      });
    }

    return updates;
  }

  async getSubjectMastery(
    userId: string,
    subjectId: string,
  ): Promise<SubjectMasteryResponseDto> {
    await this.getOwnedSubjectOrThrow(userId, subjectId);

    const documents = await this.documentRepository.find({
      where: { subjectId, ownerUserId: userId },
      select: ['id'],
    });
    if (documents.length === 0) {
      return {
        subjectId,
        overallMastery: 0,
        strongKeywords: [],
        weakKeywords: [],
      };
    }

    const keywords = await this.keywordRepository.find({
      where: { documentId: In(documents.map((document) => document.id)) },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
    if (keywords.length === 0) {
      return {
        subjectId,
        overallMastery: 0,
        strongKeywords: [],
        weakKeywords: [],
      };
    }

    const masteryRows = await this.masteryScoreRepository.find({
      where: {
        userId,
        keywordId: In(keywords.map((keyword) => keyword.id)),
      },
    });
    const masteryByKeywordId = new Map(
      masteryRows.map((mastery) => [mastery.keywordId, mastery]),
    );

    const attemptedKeywords = keywords
      .map((keyword) => {
        const mastery = masteryByKeywordId.get(keyword.id);
        if (!mastery) {
          return null;
        }
        return {
          keywordId: keyword.id,
          name: keyword.name,
          masteryScore: this.roundScore(this.toNumber(mastery.masteryScore, 0)),
        };
      })
      .filter(
        (keyword): keyword is NonNullable<typeof keyword> => keyword != null,
      );

    const overallMastery =
      attemptedKeywords.length === 0
        ? 0
        : this.roundScore(
            attemptedKeywords.reduce(
              (sum, keyword) => sum + keyword.masteryScore,
              0,
            ) / attemptedKeywords.length,
          );

    return {
      subjectId,
      overallMastery,
      strongKeywords: attemptedKeywords.filter(
        (keyword) => keyword.masteryScore >= 0.7,
      ),
      weakKeywords: attemptedKeywords.filter(
        (keyword) => keyword.masteryScore < 0.4,
      ),
    };
  }

  async calculateDocumentCoverage(
    userId: string,
    documentId: string,
  ): Promise<number> {
    await this.getOwnedDocumentOrThrow(userId, documentId);
    const keywords = await this.keywordRepository.find({
      where: { documentId },
      select: ['id'],
    });

    return this.calculateCoverageForKeywords(
      keywords.map((keyword) => keyword.id),
    );
  }

  async calculateSubjectCoverage(
    userId: string,
    subjectId: string,
  ): Promise<number> {
    await this.getOwnedSubjectOrThrow(userId, subjectId);
    const documents = await this.documentRepository.find({
      where: { subjectId, ownerUserId: userId },
      select: ['id'],
    });
    if (documents.length === 0) {
      return 0;
    }

    const keywords = await this.keywordRepository.find({
      where: { documentId: In(documents.map((document) => document.id)) },
      select: ['id'],
    });

    return this.calculateCoverageForKeywords(
      keywords.map((keyword) => keyword.id),
    );
  }

  async getSubjectDashboard(
    userId: string,
    subjectId: string,
  ): Promise<SubjectDashboardResponseDto> {
    const mastery = await this.getSubjectMastery(userId, subjectId);
    const [coverage, documents, recentQuizAttempts] = await Promise.all([
      this.calculateSubjectCoverage(userId, subjectId),
      this.getSubjectDashboardDocuments(userId, subjectId),
      this.getRecentQuizAttempts(userId, { subjectId }),
    ]);

    return {
      ...mastery,
      coverage,
      documents,
      recentQuizAttempts,
    };
  }

  async getSubjectLearningStatus(
    userId: string,
    subjectId: string,
  ): Promise<SubjectLearningStatusResponseDto> {
    const [mastery, coverage] = await Promise.all([
      this.getSubjectMastery(userId, subjectId),
      this.calculateSubjectCoverage(userId, subjectId),
    ]);

    return {
      subjectId,
      mastery: mastery.overallMastery,
      coverage,
      strongKeywords: mastery.strongKeywords,
      weakKeywords: mastery.weakKeywords,
    };
  }

  async getDocumentLearningStatus(
    userId: string,
    documentId: string,
  ): Promise<DocumentLearningStatusResponseDto> {
    await this.getOwnedDocumentOrThrow(userId, documentId);
    const [mastery, coverage, keywordStatuses] = await Promise.all([
      this.calculateDocumentMastery(userId, documentId),
      this.calculateDocumentCoverage(userId, documentId),
      this.getDocumentKeywordLearningStatuses(userId, documentId),
    ]);

    return {
      documentId,
      mastery,
      coverage,
      strongKeywords: keywordStatuses.filter(
        (keyword) => keyword.masteryScore >= 0.7,
      ),
      weakKeywords: keywordStatuses.filter(
        (keyword) => keyword.masteryScore < 0.4,
      ),
    };
  }

  private async calculateDocumentMastery(
    userId: string,
    documentId: string,
  ): Promise<number> {
    const keywordStatuses = await this.getDocumentKeywordLearningStatuses(
      userId,
      documentId,
    );
    if (keywordStatuses.length === 0) {
      return 0;
    }

    return this.roundScore(
      keywordStatuses.reduce((sum, keyword) => sum + keyword.masteryScore, 0) /
        keywordStatuses.length,
    );
  }

  private async recalculateKeywordMastery(input: {
    userId: string;
    keywordId: string;
    answeredAt: Date;
  }): Promise<MasteryScore> {
    const attempts = await this.loadAnsweredAttempts(
      input.userId,
      input.keywordId,
    );
    const attemptsCount = attempts.length;
    const correctCount = attempts.filter(
      (attempt) => attempt.isCorrect === true,
    ).length;
    const recentCorrectRate = this.roundScore(
      attemptsCount === 0 ? 0 : correctCount / attemptsCount,
    );
    const noHintBonus = this.roundScore(
      attemptsCount === 0
        ? 0
        : attempts.filter((attempt) => attempt.usedHint !== true).length /
            attemptsCount,
    );
    const difficultyWeightedScore = this.roundScore(
      calculateDifficultyWeightedScore(
        attempts.map(
          (attempt): DifficultyWeightedAttempt => ({
            difficulty: attempt.quizProblem.difficulty,
            isCorrect: attempt.isCorrect === true,
          }),
        ),
      ),
    );
    const masteryScore = this.roundScore(
      0.7 * recentCorrectRate +
        0.2 * difficultyWeightedScore +
        0.1 * noHintBonus,
    );

    const existing = await this.masteryScoreRepository.findOne({
      where: {
        userId: input.userId,
        keywordId: input.keywordId,
      },
    });
    const row = existing
      ? Object.assign(existing, {
          attempts: attemptsCount,
          correctCount,
          masteryScore,
          recentCorrectRate,
          difficultyWeightedScore,
          noHintBonus,
          lastAttemptedAt: input.answeredAt,
        })
      : this.masteryScoreRepository.create({
          userId: input.userId,
          keywordId: input.keywordId,
          attempts: attemptsCount,
          correctCount,
          masteryScore,
          recentCorrectRate,
          difficultyWeightedScore,
          noHintBonus,
          lastAttemptedAt: input.answeredAt,
        });

    return this.masteryScoreRepository.save(row);
  }

  private loadAnsweredAttempts(
    userId: string,
    keywordId: string,
  ): Promise<
    Array<QuizProblemAttemptEntity & { quizProblem: QuizProblemEntity }>
  > {
    return this.quizProblemAttemptRepository
      .createQueryBuilder('problemAttempt')
      .innerJoinAndSelect('problemAttempt.quizProblem', 'quizProblem')
      .innerJoin(
        'quizProblem.quizProblemKeywords',
        'quizProblemKeyword',
        'quizProblemKeyword.keywordId = :keywordId',
        { keywordId },
      )
      .where('problemAttempt.userId = :userId', { userId })
      .andWhere('problemAttempt.isCorrect IS NOT NULL')
      .orderBy('problemAttempt.submittedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('problemAttempt.updatedAt', 'DESC')
      .getMany() as Promise<
      Array<QuizProblemAttemptEntity & { quizProblem: QuizProblemEntity }>
    >;
  }

  private async calculateCoverageForKeywords(
    keywordIds: string[],
  ): Promise<number> {
    const uniqueKeywordIds = [...new Set(keywordIds)];
    if (uniqueKeywordIds.length === 0) {
      return 0;
    }

    const mappings = await this.quizProblemKeywordRepository.find({
      where: { keywordId: In(uniqueKeywordIds) },
      select: ['keywordId'],
    });
    const coveredKeywordIds = new Set(
      mappings.map((mapping) => mapping.keywordId),
    );

    return this.roundScore(coveredKeywordIds.size / uniqueKeywordIds.length);
  }

  private async getDocumentKeywordLearningStatuses(
    userId: string,
    documentId: string,
  ): Promise<SubjectMasteryKeywordDto[]> {
    const keywords = await this.keywordRepository.find({
      where: { documentId },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
    if (keywords.length === 0) {
      return [];
    }

    const masteryRows = await this.masteryScoreRepository.find({
      where: {
        userId,
        keywordId: In(keywords.map((keyword) => keyword.id)),
      },
    });
    const masteryByKeywordId = new Map(
      masteryRows.map((mastery) => [mastery.keywordId, mastery]),
    );

    return keywords
      .map((keyword) => {
        const mastery = masteryByKeywordId.get(keyword.id);
        if (!mastery) {
          return null;
        }
        return {
          keywordId: keyword.id,
          name: keyword.name,
          masteryScore: this.roundScore(this.toNumber(mastery.masteryScore, 0)),
        };
      })
      .filter(
        (keyword): keyword is NonNullable<typeof keyword> => keyword != null,
      );
  }

  private async getSubjectDashboardDocuments(
    userId: string,
    subjectId: string,
  ): Promise<SubjectDashboardDocumentDto[]> {
    const documents = await this.documentRepository.find({
      where: { subjectId, ownerUserId: userId },
      select: ['id', 'title', 'analysisStatus'],
      order: { createdAt: 'DESC' },
    });
    if (documents.length === 0) {
      return [];
    }

    const keywords = await this.keywordRepository.find({
      where: { documentId: In(documents.map((document) => document.id)) },
      select: ['id', 'documentId'],
    });
    const keywordCountByDocumentId = new Map<string, number>();
    for (const keyword of keywords) {
      keywordCountByDocumentId.set(
        keyword.documentId,
        (keywordCountByDocumentId.get(keyword.documentId) ?? 0) + 1,
      );
    }

    return documents.map((document) => ({
      documentId: document.id,
      title: document.title ?? null,
      analysisStatus: document.analysisStatus,
      keywordCount: keywordCountByDocumentId.get(document.id) ?? 0,
    }));
  }

  private async getRecentQuizAttempts(
    userId: string,
    filter: { subjectId?: string; documentId?: string },
  ): Promise<RecentQuizAttemptDto[]> {
    const query = this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .innerJoinAndSelect('attempt.quiz', 'quiz')
      .where('attempt.userId = :userId', { userId });

    if (filter.subjectId) {
      query.andWhere('quiz.subjectId = :subjectId', {
        subjectId: filter.subjectId,
      });
    }
    if (filter.documentId) {
      query.andWhere('quiz.documentId = :documentId', {
        documentId: filter.documentId,
      });
    }

    const attempts = (await query
      .orderBy('attempt.startedAt', 'DESC')
      .addOrderBy('attempt.createdAt', 'DESC')
      .take(5)
      .getMany()) as Array<QuizAttemptEntity & { quiz: QuizEntity }>;

    return attempts.map((attempt) => ({
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt
        ? attempt.submittedAt.toISOString()
        : null,
      score: attempt.score == null ? null : this.toNumber(attempt.score, 0),
    }));
  }

  private async getOwnedDocumentOrThrow(
    userId: string,
    documentId: string,
  ): Promise<DocumentEntity> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      select: ['id', 'ownerUserId'],
    });
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    if (document.ownerUserId !== userId) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    return document;
  }

  private async getOwnedSubjectOrThrow(
    userId: string,
    subjectId: string,
  ): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId },
      select: ['id', 'userId'],
    });
    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }
    if (subject.userId !== userId) {
      throw new ForbiddenException('You do not have access to this subject.');
    }
    return subject;
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private roundScore(value: number): number {
    return Number(this.clampScore(value).toFixed(4));
  }

  private toNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }
}
