import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import {
  CreateDocumentQuizDto,
  DEFAULT_LECTURE_QUIZ_PROBLEM_COUNT,
} from './dto/create-document-quiz.dto';
import { CreateQuizResponseDto } from './dto/create-quiz-response.dto';
import { DocumentQuizListItemDto } from './dto/document-quiz-list-response.dto';
import { GeneratedQuizProblemDto } from './dto/generated-quiz-problem.dto';
import { QuizSolvingViewResponseDto } from './dto/quiz-solving-view-response.dto';
import { DifficultyLevel } from './enums/difficulty-level.enum';
import { QuizProblemType } from './enums/quiz-problem-type.enum';
import { QuizType } from './enums/quiz-type.enum';
import { QuizEntity } from './entities/quiz.entity';
import { QuizProblemChoiceEntity } from './entities/quiz-problem-choice.entity';
import { QuizProblemEntity } from './entities/quiz-problem.entity';
import { QuizProblemKeyword } from './entities/quiz-problem-keyword.entity';
import { QuizAiGenerationService } from './quiz-ai-generation.service';
import { QuizTargetSelectorService } from './quiz-target-selector.service';
import { calculateFinalDifficulty } from './utils/difficulty-calculator';

export interface PersistGeneratedQuizInput {
  userId: string;
  subjectId: string;
  documentId?: string | null;
  quizType: QuizType;
  title: string;
  description?: string | null;
  quizProblemCount: number;
  generatedProblems: GeneratedQuizProblemDto[];
}

export interface PersistGeneratedQuizResult {
  quiz: QuizEntity;
  quizProblemIds: string[];
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly quizTargetSelectorService: QuizTargetSelectorService,
    private readonly quizAiGenerationService: QuizAiGenerationService,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
    @InjectRepository(QuizEntity)
    private readonly quizRepository: Repository<QuizEntity>,
    @InjectRepository(QuizAttemptEntity)
    private readonly quizAttemptRepository: Repository<QuizAttemptEntity>,
    @InjectRepository(QuizProblemEntity)
    private readonly quizProblemRepository: Repository<QuizProblemEntity>,
    @InjectRepository(QuizProblemChoiceEntity)
    private readonly quizProblemChoiceRepository: Repository<QuizProblemChoiceEntity>,
    @InjectRepository(QuizProblemKeyword)
    private readonly quizProblemKeywordRepository: Repository<QuizProblemKeyword>,
  ) {}

  async createLectureQuiz(
    userId: string,
    documentId: string,
    dto: CreateDocumentQuizDto,
  ): Promise<CreateQuizResponseDto> {
    const targetProblemCount =
      dto.quizProblemCount ?? DEFAULT_LECTURE_QUIZ_PROBLEM_COUNT;

    const plan = await this.quizTargetSelectorService.selectLectureQuizTargets({
      userId,
      documentId,
      quizProblemCount: targetProblemCount,
      keywordIds: dto.keywordIds,
      difficulty: dto.difficulty ?? null,
    });

    const aiGeneratedProblems =
      await this.quizAiGenerationService.generateLectureQuiz(plan);
    const generatedProblems = this.prepareGeneratedProblemsForSaving(
      plan,
      aiGeneratedProblems,
    );

    const document = await this.documentRepository.findOne({
      where: { id: plan.documentId },
      select: ['id', 'title'],
    });
    if (!document) {
      throw new InternalServerErrorException(
        'Target document was not found during quiz save.',
      );
    }

    const savedQuiz = await this.persistGeneratedQuiz({
      userId: plan.userId,
      subjectId: plan.subjectId,
      documentId: plan.documentId,
      quizType: QuizType.LECTURE,
      title: this.buildQuizTitle(document.title),
      description: null,
      quizProblemCount: generatedProblems.length,
      generatedProblems,
    });

    return {
      quizId: savedQuiz.quiz.id,
      quizType: savedQuiz.quiz.quizType,
      quizProblemCount: generatedProblems.length,
    };
  }

  async persistGeneratedQuiz(
    input: PersistGeneratedQuizInput,
    entityManager?: EntityManager,
  ): Promise<PersistGeneratedQuizResult> {
    if (entityManager) {
      return this.persistGeneratedQuizWithManager(input, entityManager);
    }

    return this.dataSource.transaction((manager) =>
      this.persistGeneratedQuizWithManager(input, manager),
    );
  }

  private async persistGeneratedQuizWithManager(
    input: PersistGeneratedQuizInput,
    manager: EntityManager,
  ): Promise<PersistGeneratedQuizResult> {
    const quiz = await manager.save(
      this.quizRepository.create({
        userId: input.userId,
        subjectId: input.subjectId,
        documentId: input.documentId ?? null,
        quizType: input.quizType,
        title: input.title,
        description: input.description ?? null,
        quizProblemCount: input.quizProblemCount,
      }),
    );

    const allUsedKeywordIds = new Set<string>();
    const quizProblemIds: string[] = [];

    for (let index = 0; index < input.generatedProblems.length; index += 1) {
      const generatedProblem = input.generatedProblems[index];
      const savedProblem = await manager.save(
        this.quizProblemRepository.create({
          quizId: quiz.id,
          problemText: generatedProblem.problemText.trim(),
          quizProblemType: generatedProblem.quizProblemType,
          answerText: generatedProblem.answerText.trim(),
          explanation: generatedProblem.explanation.trim(),
          difficulty: generatedProblem.difficulty,
          hintLevel1: generatedProblem.hintLevel1?.trim() || null,
          hintLevel2: generatedProblem.hintLevel2?.trim() || null,
          hintLevel3: generatedProblem.hintLevel3?.trim() || null,
          displayOrder: index + 1,
        }),
      );
      quizProblemIds.push(savedProblem.id);

      if (generatedProblem.choices && generatedProblem.choices.length > 0) {
        const choiceRows = generatedProblem.choices.map((choice) =>
          this.quizProblemChoiceRepository.create({
            quizProblemId: savedProblem.id,
            choiceText: choice.choiceText.trim(),
            isCorrect: choice.isCorrect,
            displayOrder: choice.displayOrder,
          }),
        );
        await manager.save(choiceRows);
      }

      const uniqueKeywordIds = [...new Set(generatedProblem.keywordIds)];
      const weight =
        uniqueKeywordIds.length <= 1
          ? 1
          : Number((1 / uniqueKeywordIds.length).toFixed(4));
      const mappingRows = uniqueKeywordIds.map((keywordId) =>
        this.quizProblemKeywordRepository.create({
          quizProblemId: savedProblem.id,
          keywordId,
          weight,
        }),
      );
      if (mappingRows.length > 0) {
        await manager.save(mappingRows);
      }

      for (const keywordId of uniqueKeywordIds) {
        allUsedKeywordIds.add(keywordId);
      }
    }

    if (allUsedKeywordIds.size > 0) {
      await manager.update(
        Keyword,
        { id: In([...allUsedKeywordIds]) },
        { isUsedInAssessment: true },
      );
    }

    return { quiz, quizProblemIds };
  }

  prepareGeneratedProblemsForSaving(
    plan: {
      quizProblemCount: number;
      difficultyDistribution: {
        easyCount: number;
        mediumCount: number;
        hardCount: number;
      };
      targets: { keywordId: string }[];
      sourceChunks: { chunkId: string }[];
    },
    generatedProblems: GeneratedQuizProblemDto[],
  ): GeneratedQuizProblemDto[] {
    const validProblems = this.filterValidGeneratedProblems(
      plan,
      generatedProblems,
    );
    return this.selectProblemsForSaving(plan, validProblems);
  }

  async listDocumentQuizzes(
    userId: string,
    documentId: string,
  ): Promise<DocumentQuizListItemDto[]> {
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

    const quizzes = await this.quizRepository.find({
      where: { documentId, userId },
      select: ['id', 'title', 'quizType', 'quizProblemCount', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
    if (quizzes.length === 0) {
      return [];
    }

    const quizIds = quizzes.map((quiz) => quiz.id);
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

    return quizzes.map((quiz) => {
      const latestAttempt = latestAttemptByQuizId.get(quiz.id);

      return {
        quizId: quiz.id,
        title: quiz.title,
        quizType: quiz.quizType,
        quizProblemCount: quiz.quizProblemCount ?? null,
        createdAt: quiz.createdAt.toISOString(),
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

  async getQuizForSolving(
    userId: string,
    quizId: string,
  ): Promise<QuizSolvingViewResponseDto> {
    const quizOwnership = await this.quizRepository.findOne({
      where: { id: quizId },
      select: ['id', 'userId'],
    });
    if (!quizOwnership) {
      throw new NotFoundException('Quiz not found.');
    }
    if (quizOwnership.userId !== userId) {
      throw new ForbiddenException('You do not have access to this quiz.');
    }

    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: {
        quizProblems: {
          quizProblemChoices: true,
        },
      },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found.');
    }

    const sortedProblems = [...(quiz.quizProblems ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder,
    );

    return {
      id: quiz.id,
      title: quiz.title,
      quizType: quiz.quizType,
      quizProblems: sortedProblems.map((problem) => ({
        id: problem.id,
        problemText: problem.problemText,
        quizProblemType: problem.quizProblemType,
        difficulty: problem.difficulty,
        displayOrder: problem.displayOrder,
        hintLevel1: problem.hintLevel1 ?? null,
        hintLevel2: problem.hintLevel2 ?? null,
        hintLevel3: problem.hintLevel3 ?? null,
        choices: [...(problem.quizProblemChoices ?? [])]
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((choice) => ({
            id: choice.id,
            choiceText: choice.choiceText,
            displayOrder: choice.displayOrder,
          })),
      })),
    };
  }

  private buildQuizTitle(documentTitle?: string | null): string {
    const trimmed = documentTitle?.trim();
    if (!trimmed) {
      return 'Lecture Quiz';
    }
    return `${trimmed} Quiz`;
  }

  private toNumber(value: number | string): number {
    return typeof value === 'number' ? value : Number(value);
  }

  private filterValidGeneratedProblems(
    plan: {
      quizProblemCount: number;
      difficultyDistribution: {
        easyCount: number;
        mediumCount: number;
        hardCount: number;
      };
      targets: { keywordId: string }[];
      sourceChunks: { chunkId: string }[];
    },
    generatedProblems: GeneratedQuizProblemDto[],
  ): GeneratedQuizProblemDto[] {
    const validKeywordIdSet = new Set(
      plan.targets.map((target) => target.keywordId),
    );
    const validChunkIdSet = new Set(
      plan.sourceChunks.map((chunk) => chunk.chunkId),
    );
    const normalizedProblems: GeneratedQuizProblemDto[] = [];

    for (const problem of generatedProblems) {
      const problemText = problem.problemText?.trim() ?? '';
      const answerText = problem.answerText?.trim() ?? '';
      if (!problemText || !answerText) {
        continue;
      }

      const keywordIds = [...new Set(problem.keywordIds)].filter((keywordId) =>
        validKeywordIdSet.has(keywordId),
      );
      const sourceChunkIds = [...new Set(problem.sourceChunkIds)].filter(
        (chunkId) => validChunkIdSet.has(chunkId),
      );
      if (keywordIds.length === 0 || sourceChunkIds.length === 0) {
        continue;
      }
      const evidenceChunkIds = [
        ...new Set(
          problem.evidenceChunkIds.length > 0
            ? problem.evidenceChunkIds
            : sourceChunkIds,
        ),
      ].filter((chunkId) => validChunkIdSet.has(chunkId));

      let choices = (problem.choices ?? [])
        .map((choice, index) => ({
          choiceText: choice.choiceText?.trim() ?? '',
          isCorrect: choice.isCorrect === true,
          displayOrder: index + 1,
        }))
        .filter((choice) => choice.choiceText.length > 0);

      if (problem.quizProblemType === QuizProblemType.SHORT_ANSWER) {
        choices = [];
      } else {
        choices = choices.slice(0, 4);
      }

      if (problem.quizProblemType === QuizProblemType.SINGLE_CHOICE) {
        if (choices.length < 2) {
          continue;
        }
        let correctIndex = choices.findIndex((choice) => choice.isCorrect);
        if (correctIndex < 0) {
          correctIndex = 0;
        }
        choices = choices.map((choice, index) => ({
          ...choice,
          isCorrect: index === correctIndex,
          displayOrder: index + 1,
        }));
      }

      if (problem.quizProblemType === QuizProblemType.MULTIPLE_CHOICE) {
        if (choices.length < 2) {
          continue;
        }
        choices = choices.map((choice, index) => ({
          ...choice,
          displayOrder: index + 1,
        }));
      }

      const finalDifficulty = calculateFinalDifficulty({
        difficultyFeatures: problem.difficultyFeatures,
        aiProvidedDifficulty: problem.difficulty,
        hasValidDifficultyFeatures: problem.hasValidDifficultyFeatures,
      });
      this.logger.log(
        `Quiz difficulty resolved: modelPredictedDifficulty=${problem.modelPredictedDifficulty}, aiProvidedDifficulty=${problem.difficulty}, finalDifficulty=${finalDifficulty}, usedFeatureCalculator=${problem.hasValidDifficultyFeatures !== false}`,
      );

      normalizedProblems.push({
        ...problem,
        problemText,
        answerText,
        explanation: problem.explanation?.trim() ?? '',
        difficulty: finalDifficulty,
        keywordIds,
        sourceChunkIds,
        evidenceChunkIds:
          evidenceChunkIds.length > 0 ? evidenceChunkIds : sourceChunkIds,
        choices:
          problem.quizProblemType === QuizProblemType.SHORT_ANSWER
            ? undefined
            : choices,
      });
    }

    return normalizedProblems;
  }

  private selectProblemsForSaving(
    plan: {
      quizProblemCount: number;
      difficultyDistribution: {
        easyCount: number;
        mediumCount: number;
        hardCount: number;
      };
    },
    generatedProblems: GeneratedQuizProblemDto[],
  ): GeneratedQuizProblemDto[] {
    if (generatedProblems.length === 0) {
      throw new BadRequestException('AI generated no valid quiz problems.');
    }

    if (generatedProblems.length <= plan.quizProblemCount) {
      return generatedProblems;
    }

    const withIndex = generatedProblems.map((problem, index) => ({
      problem,
      index,
    }));
    const buckets = {
      [DifficultyLevel.EASY]: withIndex.filter(
        (item) => item.problem.difficulty === DifficultyLevel.EASY,
      ),
      [DifficultyLevel.MEDIUM]: withIndex.filter(
        (item) => item.problem.difficulty === DifficultyLevel.MEDIUM,
      ),
      [DifficultyLevel.HARD]: withIndex.filter(
        (item) => item.problem.difficulty === DifficultyLevel.HARD,
      ),
    };

    const takeFromBucket = (
      difficulty: DifficultyLevel,
      count: number,
      selected: Array<{ problem: GeneratedQuizProblemDto; index: number }>,
      selectedIndexSet: Set<number>,
    ) => {
      const bucket = buckets[difficulty];
      let taken = 0;
      for (const item of bucket) {
        if (taken >= count) {
          break;
        }
        if (selectedIndexSet.has(item.index)) {
          continue;
        }
        selected.push(item);
        selectedIndexSet.add(item.index);
        taken += 1;
      }
    };

    const selected: Array<{ problem: GeneratedQuizProblemDto; index: number }> =
      [];
    const selectedIndexSet = new Set<number>();

    takeFromBucket(
      DifficultyLevel.EASY,
      plan.difficultyDistribution.easyCount,
      selected,
      selectedIndexSet,
    );
    takeFromBucket(
      DifficultyLevel.MEDIUM,
      plan.difficultyDistribution.mediumCount,
      selected,
      selectedIndexSet,
    );
    takeFromBucket(
      DifficultyLevel.HARD,
      plan.difficultyDistribution.hardCount,
      selected,
      selectedIndexSet,
    );

    if (selected.length < plan.quizProblemCount) {
      for (const item of withIndex) {
        if (selected.length >= plan.quizProblemCount) {
          break;
        }
        if (selectedIndexSet.has(item.index)) {
          continue;
        }
        selected.push(item);
        selectedIndexSet.add(item.index);
      }
    }

    return selected
      .sort((left, right) => left.index - right.index)
      .slice(0, plan.quizProblemCount)
      .map((item) => item.problem);
  }
}
