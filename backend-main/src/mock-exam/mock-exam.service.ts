import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import {
  QuizGenerationTargetPlan,
  QuizKeywordTarget,
  QuizSourceChunk,
} from '../quiz/dto/quiz-generation-target-plan.dto';
import { DifficultyLevel } from '../quiz/enums/difficulty-level.enum';
import { QuizType } from '../quiz/enums/quiz-type.enum';
import { QuizAiGenerationService } from '../quiz/quiz-ai-generation.service';
import { QuizService } from '../quiz/quiz.service';
import { SubjectsService } from '../subjects/subjects.service';
import { CreateMockExamDto } from './dto/create-mock-exam.dto';
import { CreateMockExamResponseDto } from './dto/create-mock-exam-response.dto';
import { MockExamListItemDto } from './dto/mock-exam-list-response.dto';
import { MockExamProblem } from './entities/mock-exam-problem.entity';
import { MockExam } from './entities/mock-exam.entity';

interface KeywordCandidate {
  keyword: Keyword;
  masteryScore: number | null;
  attempts: number;
  importanceScore: number;
  priorityScore: number;
}

interface KeywordSourceContext {
  keywordSourceChunkIds: Map<string, string[]>;
  sourceChunks: QuizSourceChunk[];
}

@Injectable()
export class MockExamService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly subjectsService: SubjectsService,
    private readonly quizService: QuizService,
    private readonly quizAiGenerationService: QuizAiGenerationService,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(KeywordChunkEntity)
    private readonly keywordChunkRepository: Repository<KeywordChunkEntity>,
    @InjectRepository(MasteryScore)
    private readonly masteryScoreRepository: Repository<MasteryScore>,
    @InjectRepository(MockExam)
    private readonly mockExamRepository: Repository<MockExam>,
    @InjectRepository(MockExamProblem)
    private readonly mockExamProblemRepository: Repository<MockExamProblem>,
    @InjectRepository(QuizAttemptEntity)
    private readonly quizAttemptRepository: Repository<QuizAttemptEntity>,
  ) {}

  async createMockExam(
    userId: string,
    subjectId: string,
    dto: CreateMockExamDto,
  ): Promise<CreateMockExamResponseDto> {
    const subject = await this.subjectsService.findOne(userId, subjectId);
    const targetWeakKeywords = dto.targetWeakKeywords ?? true;
    const documents = await this.loadTargetDocuments({
      userId,
      subjectId,
      documentIds: dto.documentIds ?? [],
    });
    const documentIds = documents.map((document) => document.id);
    const keywords = await this.keywordRepository.find({
      where: { documentId: In(documentIds) },
      order: { importanceScore: 'DESC', name: 'ASC' },
    });
    if (keywords.length === 0) {
      throw new BadRequestException(
        'No keywords found for the selected mock exam scope.',
      );
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
    const candidates = this.buildKeywordCandidates(keywords, masteryByKeywordId);
    const selectedCandidates = this.selectKeywordCandidates({
      candidates,
      keywordIds: dto.keywordIds ?? [],
      targetWeakKeywords,
      quizProblemCount: dto.quizProblemCount,
    });
    const sourceContext = await this.loadKeywordSourceContext({
      selectedCandidates,
      selectedDocumentIds: documentIds,
      explicitKeywordIds: dto.keywordIds ?? [],
    });
    const targets = this.buildTargets({
      selectedCandidates,
      sourceContext,
      quizProblemCount: dto.quizProblemCount,
    });
    if (targets.length === 0) {
      throw new BadRequestException(
        'No selected keywords have source chunks for mock exam generation.',
      );
    }

    const plan: QuizGenerationTargetPlan = {
      documentId: documents[0].id,
      subjectId,
      userId,
      quizProblemCount: dto.quizProblemCount,
      difficultyDistribution: this.resolveDifficultyDistribution(
        dto.quizProblemCount,
        targets.map((target) => target.masteryScore),
      ),
      targets,
      sourceChunks: sourceContext.sourceChunks,
    };

    const aiGeneratedProblems =
      await this.quizAiGenerationService.generateLectureQuiz(plan);
    const generatedProblems = this.quizService.prepareGeneratedProblemsForSaving(
      plan,
      aiGeneratedProblems,
    );
    const { persistedQuiz, mockExam } = await this.dataSource.transaction(
      async (manager) => {
        const persistedQuiz = await this.quizService.persistGeneratedQuiz(
          {
            userId,
            subjectId,
            documentId: null,
            quizType: QuizType.MOCK_EXAM,
            title: `${subject.name} Mock Exam`,
            description: null,
            quizProblemCount: generatedProblems.length,
            generatedProblems,
          },
          manager,
        );

        const mockExam = await manager.save(
          this.mockExamRepository.create({
            quizId: persistedQuiz.quiz.id,
            subjectId,
            userId,
            quizProblemCount: generatedProblems.length,
            targetWeakKeywords,
            generatedFromMastery: targetWeakKeywords,
          }),
        );

        const problemRows = persistedQuiz.quizProblemIds.map(
          (quizProblemId, index) =>
            this.mockExamProblemRepository.create({
              mockExamId: mockExam.id,
              quizProblemId,
              displayOrder: index + 1,
            }),
        );
        if (problemRows.length > 0) {
          await manager.save(problemRows);
        }

        return { persistedQuiz, mockExam };
      },
    );

    return {
      mockExamId: mockExam.id,
      quizId: persistedQuiz.quiz.id,
      quizType: QuizType.MOCK_EXAM,
      quizProblemCount: generatedProblems.length,
    };
  }

  async listMockExams(
    userId: string,
    subjectId: string,
  ): Promise<MockExamListItemDto[]> {
    await this.subjectsService.findOne(userId, subjectId);

    const mockExams = await this.mockExamRepository
      .createQueryBuilder('mockExam')
      .innerJoinAndSelect('mockExam.quiz', 'quiz')
      .where('mockExam.subjectId = :subjectId', { subjectId })
      .andWhere('mockExam.userId = :userId', { userId })
      .andWhere('quiz.subjectId = :subjectId', { subjectId })
      .andWhere('quiz.userId = :userId', { userId })
      .andWhere('quiz.quizType = :quizType', {
        quizType: QuizType.MOCK_EXAM,
      })
      .orderBy('mockExam.createdAt', 'DESC')
      .getMany();
    if (mockExams.length === 0) {
      return [];
    }

    const quizIds = mockExams.map((mockExam) => mockExam.quizId);
    const attempts = await this.quizAttemptRepository.find({
      where: {
        quizId: In(quizIds),
        userId,
      },
      select: [
        'id',
        'quizId',
        'status',
        'startedAt',
        'submittedAt',
        'totalQuizProblems',
        'correctCount',
        'score',
        'createdAt',
      ],
      order: {
        startedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    const latestAttemptByQuizId = new Map<string, QuizAttemptEntity>();
    for (const attempt of attempts) {
      if (!latestAttemptByQuizId.has(attempt.quizId)) {
        latestAttemptByQuizId.set(attempt.quizId, attempt);
      }
    }

    return mockExams.map((mockExam) => {
      const latestAttempt = latestAttemptByQuizId.get(mockExam.quizId);

      return {
        mockExamId: mockExam.id,
        quizId: mockExam.quizId,
        subjectId: mockExam.subjectId,
        title: mockExam.quiz.title,
        quizProblemCount: mockExam.quizProblemCount,
        targetWeakKeywords: mockExam.targetWeakKeywords,
        generatedFromMastery: mockExam.generatedFromMastery,
        createdAt: mockExam.createdAt.toISOString(),
        latestAttempt: latestAttempt
          ? {
              attemptId: latestAttempt.id,
              status: latestAttempt.status,
              startedAt: latestAttempt.startedAt.toISOString(),
              submittedAt: latestAttempt.submittedAt
                ? latestAttempt.submittedAt.toISOString()
                : null,
              totalQuizProblems: latestAttempt.totalQuizProblems ?? null,
              correctCount: latestAttempt.correctCount ?? null,
              score:
                latestAttempt.score == null
                  ? null
                  : this.toNumber(latestAttempt.score),
            }
          : null,
      };
    });
  }

  private async loadTargetDocuments(input: {
    userId: string;
    subjectId: string;
    documentIds: string[];
  }): Promise<DocumentEntity[]> {
    const uniqueDocumentIds = [...new Set(input.documentIds)];
    const where =
      uniqueDocumentIds.length > 0
        ? {
            id: In(uniqueDocumentIds),
            subjectId: input.subjectId,
            ownerUserId: input.userId,
          }
        : {
            subjectId: input.subjectId,
            ownerUserId: input.userId,
          };

    const documents = await this.documentRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    if (uniqueDocumentIds.length > 0 && documents.length !== uniqueDocumentIds.length) {
      throw new BadRequestException(
        'All documentIds must belong to the subject and current user.',
      );
    }
    if (
      uniqueDocumentIds.length > 0 &&
      documents.some((document) => document.analysisStatus !== 'ANALYZED')
    ) {
      throw new BadRequestException(
        'All selected documents must be ANALYZED before mock exam generation.',
      );
    }
    if (documents.length === 0) {
      throw new BadRequestException(
        'No documents found for the selected mock exam scope.',
      );
    }
    return documents;
  }

  private buildKeywordCandidates(
    keywords: Keyword[],
    masteryByKeywordId: Map<string, MasteryScore>,
  ): KeywordCandidate[] {
    return keywords.map((keyword) => {
      const mastery = masteryByKeywordId.get(keyword.id);
      const masteryScore = mastery ? Number(mastery.masteryScore) : null;
      const attempts = mastery?.attempts ?? 0;
      const importanceScore =
        keyword.importanceScore == null ? 0.5 : Number(keyword.importanceScore);
      const masteryGapScore = masteryScore == null ? 0.6 : 1 - masteryScore;
      const priorityScore =
        0.6 * masteryGapScore + 0.4 * importanceScore;

      return {
        keyword,
        masteryScore,
        attempts,
        importanceScore,
        priorityScore,
      };
    });
  }

  private selectKeywordCandidates(input: {
    candidates: KeywordCandidate[];
    keywordIds: string[];
    targetWeakKeywords: boolean;
    quizProblemCount: number;
  }): KeywordCandidate[] {
    const candidateByKeywordId = new Map(
      input.candidates.map((candidate) => [candidate.keyword.id, candidate]),
    );
    const selected: KeywordCandidate[] = [];
    const selectedKeywordIds = new Set<string>();

    const append = (candidate: KeywordCandidate | undefined) => {
      if (!candidate || selectedKeywordIds.has(candidate.keyword.id)) {
        return;
      }
      selected.push(candidate);
      selectedKeywordIds.add(candidate.keyword.id);
    };

    const explicitKeywordIds = [...new Set(input.keywordIds)];
    for (const keywordId of explicitKeywordIds) {
      const candidate = candidateByKeywordId.get(keywordId);
      if (!candidate) {
        throw new BadRequestException(
          'All keywordIds must belong to the selected mock exam scope.',
        );
      }
      append(candidate);
    }

    if (input.targetWeakKeywords) {
      input.candidates
        .filter(
          (candidate) =>
            candidate.masteryScore !== null && candidate.masteryScore < 0.4,
        )
        .sort((left, right) => {
          if ((left.masteryScore ?? 0) !== (right.masteryScore ?? 0)) {
            return (left.masteryScore ?? 0) - (right.masteryScore ?? 0);
          }
          return right.importanceScore - left.importanceScore;
        })
        .forEach(append);
    }

    input.candidates
      .filter((candidate) => candidate.masteryScore === null)
      .sort((left, right) => right.importanceScore - left.importanceScore)
      .forEach(append);

    [...input.candidates]
      .sort((left, right) => right.importanceScore - left.importanceScore)
      .forEach(append);

    const targetKeywordCount = Math.max(
      1,
      Math.min(input.quizProblemCount, input.candidates.length),
    );
    return selected.slice(0, targetKeywordCount);
  }

  private async loadKeywordSourceContext(input: {
    selectedCandidates: KeywordCandidate[];
    selectedDocumentIds: string[];
    explicitKeywordIds: string[];
  }): Promise<KeywordSourceContext> {
    const keywordIds = input.selectedCandidates.map(
      (candidate) => candidate.keyword.id,
    );
    if (keywordIds.length === 0) {
      return {
        keywordSourceChunkIds: new Map(),
        sourceChunks: [],
      };
    }

    const selectedDocumentIdSet = new Set(input.selectedDocumentIds);
    const keywordChunks = await this.keywordChunkRepository.find({
      where: { keywordId: In(keywordIds) },
      relations: { documentChunk: true },
      order: { createdAt: 'ASC' },
    });
    const keywordSourceChunkIds = new Map<string, string[]>();
    const sourceChunkById = new Map<string, QuizSourceChunk>();

    for (const keywordChunk of keywordChunks) {
      const documentChunk = keywordChunk.documentChunk;
      if (!documentChunk || !selectedDocumentIdSet.has(documentChunk.documentId)) {
        continue;
      }

      const sourceChunk = sourceChunkById.get(documentChunk.id);
      if (!sourceChunk) {
        sourceChunkById.set(documentChunk.id, {
          chunkId: documentChunk.id,
          pageNumber: documentChunk.pageNumber,
          heading: documentChunk.heading ?? null,
          content: documentChunk.content,
          evidenceText: keywordChunk.evidenceText ?? null,
          relevanceScore:
            keywordChunk.relevanceScore == null
              ? null
              : Number(keywordChunk.relevanceScore),
        });
      }

      const sourceChunkIds =
        keywordSourceChunkIds.get(keywordChunk.keywordId) ?? [];
      if (!sourceChunkIds.includes(documentChunk.id)) {
        sourceChunkIds.push(documentChunk.id);
      }
      keywordSourceChunkIds.set(keywordChunk.keywordId, sourceChunkIds);
    }

    const explicitMissingSourceKeywordIds = input.explicitKeywordIds.filter(
      (keywordId) => (keywordSourceChunkIds.get(keywordId) ?? []).length === 0,
    );
    if (explicitMissingSourceKeywordIds.length > 0) {
      throw new BadRequestException(
        'All explicitly selected keywordIds must have source chunks.',
      );
    }

    const sourceChunks = [...sourceChunkById.values()].sort((left, right) => {
      if (left.pageNumber !== right.pageNumber) {
        return left.pageNumber - right.pageNumber;
      }
      return left.chunkId.localeCompare(right.chunkId);
    });

    return {
      keywordSourceChunkIds,
      sourceChunks,
    };
  }

  private buildTargets(input: {
    selectedCandidates: KeywordCandidate[];
    sourceContext: KeywordSourceContext;
    quizProblemCount: number;
  }): QuizKeywordTarget[] {
    const candidatesWithSources = input.selectedCandidates.filter(
      (candidate) =>
        (input.sourceContext.keywordSourceChunkIds.get(candidate.keyword.id) ?? [])
          .length > 0,
    );
    if (candidatesWithSources.length === 0) {
      return [];
    }

    const desiredQuestionCountByKeywordId = new Map<string, number>(
      candidatesWithSources.map((candidate) => [candidate.keyword.id, 0]),
    );
    let remaining = input.quizProblemCount;
    while (remaining > 0) {
      for (const candidate of candidatesWithSources) {
        if (remaining === 0) {
          break;
        }
        desiredQuestionCountByKeywordId.set(
          candidate.keyword.id,
          (desiredQuestionCountByKeywordId.get(candidate.keyword.id) ?? 0) + 1,
        );
        remaining -= 1;
      }
    }

    return candidatesWithSources.map((candidate) => ({
      keywordId: candidate.keyword.id,
      name: candidate.keyword.name,
      description: candidate.keyword.description ?? null,
      importanceScore:
        candidate.keyword.importanceScore == null
          ? 0.5
          : Number(candidate.keyword.importanceScore),
      masteryScore: candidate.masteryScore,
      attempts: candidate.attempts,
      priorityScore: candidate.priorityScore,
      desiredQuestionCount:
        desiredQuestionCountByKeywordId.get(candidate.keyword.id) ?? 0,
      sourceChunkIds:
        input.sourceContext.keywordSourceChunkIds.get(candidate.keyword.id) ??
        [],
    }));
  }

  private resolveDifficultyDistribution(
    quizProblemCount: number,
    masteryScores: Array<number | null>,
  ): { easyCount: number; mediumCount: number; hardCount: number } {
    const knownMasteryScores = masteryScores.filter(
      (score): score is number => score !== null && Number.isFinite(score),
    );
    if (knownMasteryScores.length === 0) {
      return this.allocateDifficultyCounts(quizProblemCount, {
        easy: 0.4,
        medium: 0.5,
        hard: 0.1,
      });
    }

    const averageMastery =
      knownMasteryScores.reduce((sum, score) => sum + score, 0) /
      knownMasteryScores.length;
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
    const counts = {
      easy: Math.floor(raw.easy),
      medium: Math.floor(raw.medium),
      hard: Math.floor(raw.hard),
    };
    let remaining =
      quizProblemCount - (counts.easy + counts.medium + counts.hard);
    const order = [
      { key: 'easy' as const, fraction: raw.easy - counts.easy },
      { key: 'medium' as const, fraction: raw.medium - counts.medium },
      { key: 'hard' as const, fraction: raw.hard - counts.hard },
    ].sort((left, right) => {
      if (right.fraction !== left.fraction) {
        return right.fraction - left.fraction;
      }
      const priority = { medium: 0, easy: 1, hard: 2 } as const;
      return priority[left.key] - priority[right.key];
    });

    let cursor = 0;
    while (remaining > 0) {
      counts[order[cursor % order.length].key] += 1;
      remaining -= 1;
      cursor += 1;
    }

    return {
      easyCount: counts.easy,
      mediumCount: counts.medium,
      hardCount: counts.hard,
    };
  }

  private toNumber(value: number | string): number {
    return typeof value === 'number' ? value : Number(value);
  }
}
