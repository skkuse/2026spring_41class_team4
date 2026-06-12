import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MasteryService } from '../mastery/mastery.service';
import { QuizProblemType } from '../quiz/enums/quiz-problem-type.enum';
import { QuizEntity } from '../quiz/entities/quiz.entity';
import { QuizProblemEntity } from '../quiz/entities/quiz-problem.entity';
import { AttemptReviewResponseDto } from './dto/attempt-review-response.dto';
import { QuizAttemptStartResponseDto } from './dto/quiz-attempt-start-response.dto';
import { SubmitAnswerResponseDto } from './dto/submit-answer-response.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitAttemptResponseDto } from './dto/submit-attempt-response.dto';
import { AttemptStatus } from './enums/attempt-status.enum';
import { QuizAttemptEntity } from './entities/quiz-attempt.entity';
import { QuizProblemAttemptEntity } from './entities/quiz-problem-attempt.entity';

@Injectable()
export class QuizAttemptsService {
  constructor(
    @InjectRepository(QuizEntity)
    private readonly quizRepository: Repository<QuizEntity>,
    @InjectRepository(QuizProblemEntity)
    private readonly quizProblemRepository: Repository<QuizProblemEntity>,
    @InjectRepository(QuizAttemptEntity)
    private readonly quizAttemptRepository: Repository<QuizAttemptEntity>,
    @InjectRepository(QuizProblemAttemptEntity)
    private readonly quizProblemAttemptRepository: Repository<QuizProblemAttemptEntity>,
    private readonly masteryService: MasteryService,
  ) {}

  async startAttempt(
    userId: string,
    quizId: string,
  ): Promise<QuizAttemptStartResponseDto> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      select: ['id', 'userId'],
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found.');
    }
    if (quiz.userId !== userId) {
      throw new ForbiddenException('You do not have access to this quiz.');
    }

    const startedAt = new Date();
    const attempt = await this.quizAttemptRepository.save(
      this.quizAttemptRepository.create({
        quizId: quiz.id,
        userId,
        status: AttemptStatus.IN_PROGRESS,
        startedAt,
      }),
    );

    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      status: attempt.status,
    };
  }

  async submitAnswer(
    userId: string,
    attemptId: string,
    dto: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    const attempt = await this.getOwnedAttemptOrThrow(attemptId, userId);
    if (attempt.status === AttemptStatus.GRADED) {
      throw new BadRequestException('Attempt is already graded.');
    }

    const quizProblem = await this.quizProblemRepository.findOne({
      where: {
        id: dto.quizProblemId,
        quizId: attempt.quizId,
      },
      relations: {
        quizProblemChoices: true,
      },
    });
    if (!quizProblem) {
      throw new BadRequestException(
        'quizProblemId must belong to the quiz linked to this attempt.',
      );
    }

    const grading = this.gradeAnswer(quizProblem, dto);
    const feedback = grading.isCorrect
      ? 'Good job.'
      : 'Not quite. Review the explanation and related keywords.';

    const now = new Date();
    const existingAttempt = await this.quizProblemAttemptRepository.findOne({
      where: {
        quizAttemptId: attempt.id,
        quizProblemId: quizProblem.id,
      },
    });

    const attemptAnswer = existingAttempt
      ? Object.assign(existingAttempt, {
          userAnswer: grading.userAnswerToStore,
          isCorrect: grading.isCorrect,
          usedHint: dto.usedHint,
          hintLevelUsed: dto.hintLevelUsed ?? null,
          elapsedSeconds: dto.elapsedSeconds ?? null,
          feedback,
          submittedAt: now,
        })
      : this.quizProblemAttemptRepository.create({
          quizAttemptId: attempt.id,
          quizProblemId: quizProblem.id,
          userId,
          userAnswer: grading.userAnswerToStore,
          isCorrect: grading.isCorrect,
          usedHint: dto.usedHint,
          hintLevelUsed: dto.hintLevelUsed ?? null,
          elapsedSeconds: dto.elapsedSeconds ?? null,
          feedback,
          submittedAt: now,
        });

    await this.quizProblemAttemptRepository.save(attemptAnswer);

    const updatedMastery =
      await this.masteryService.updateMasteryForProblemAnswer({
        userId,
        quizProblemId: quizProblem.id,
        answeredAt: now,
      });

    return {
      quizProblemId: quizProblem.id,
      isCorrect: grading.isCorrect,
      explanation: quizProblem.explanation ?? undefined,
      feedback,
      updatedMastery,
      selectedChoiceIds: grading.selectedChoiceIds,
    };
  }

  async submitAttempt(
    userId: string,
    attemptId: string,
  ): Promise<SubmitAttemptResponseDto> {
    const attempt = await this.getOwnedAttemptOrThrow(attemptId, userId);
    const now = new Date();

    const quizProblems = await this.quizProblemRepository.find({
      where: { quizId: attempt.quizId },
      select: ['id'],
    });
    const totalQuizProblems = quizProblems.length;

    const existingProblemAttempts =
      await this.quizProblemAttemptRepository.find({
        where: { quizAttemptId: attempt.id },
      });
    const attemptByProblemId = new Map(
      existingProblemAttempts.map((problemAttempt) => [
        problemAttempt.quizProblemId,
        problemAttempt,
      ]),
    );

    const finalizedProblemIds: string[] = [];
    const attemptsToSave: QuizProblemAttemptEntity[] = [];

    for (const quizProblem of quizProblems) {
      const existingProblemAttempt = attemptByProblemId.get(quizProblem.id);
      if (!existingProblemAttempt) {
        attemptsToSave.push(
          this.quizProblemAttemptRepository.create({
            quizAttemptId: attempt.id,
            quizProblemId: quizProblem.id,
            userId,
            userAnswer: null,
            isCorrect: false,
            usedHint: false,
            hintLevelUsed: null,
            elapsedSeconds: null,
            feedback:
              'Unanswered problem was marked incorrect on final submission.',
            submittedAt: now,
          }),
        );
        finalizedProblemIds.push(quizProblem.id);
        continue;
      }

      if (existingProblemAttempt.isCorrect == null) {
        attemptsToSave.push(
          Object.assign(existingProblemAttempt, {
            isCorrect: false,
            feedback:
              existingProblemAttempt.feedback ??
              'Ungraded problem was marked incorrect on final submission.',
            submittedAt: existingProblemAttempt.submittedAt ?? now,
          }),
        );
        finalizedProblemIds.push(quizProblem.id);
      }
    }

    if (attemptsToSave.length > 0) {
      await this.quizProblemAttemptRepository.save(attemptsToSave);
    }

    const correctCount = await this.quizProblemAttemptRepository.count({
      where: {
        quizAttemptId: attempt.id,
        isCorrect: true,
      },
    });

    const score =
      totalQuizProblems > 0
        ? Number(((correctCount / totalQuizProblems) * 100).toFixed(2))
        : 0;

    attempt.status = AttemptStatus.GRADED;
    attempt.totalQuizProblems = totalQuizProblems;
    attempt.correctCount = correctCount;
    attempt.score = score;
    attempt.submittedAt = now;

    await this.quizAttemptRepository.save(attempt);

    for (const quizProblemId of finalizedProblemIds) {
      await this.masteryService.updateMasteryForProblemAnswer({
        userId,
        quizProblemId,
        answeredAt: now,
      });
    }

    return {
      attemptId: attempt.id,
      status: attempt.status,
      totalQuizProblems,
      correctCount,
      score,
    };
  }

  async getAttemptReview(
    userId: string,
    attemptId: string,
  ): Promise<AttemptReviewResponseDto> {
    const attempt = await this.getOwnedAttemptOrThrow(attemptId, userId);

    const quizProblems = await this.quizProblemRepository.find({
      where: { quizId: attempt.quizId },
      relations: {
        quizProblemChoices: true,
        quizProblemKeywords: {
          keyword: true,
        },
      },
      order: { displayOrder: 'ASC' },
    });

    const problemAttempts = await this.quizProblemAttemptRepository.find({
      where: { quizAttemptId: attempt.id },
    });
    const attemptByProblemId = new Map(
      problemAttempts.map((problemAttempt) => [
        problemAttempt.quizProblemId,
        problemAttempt,
      ]),
    );

    const totalQuizProblems = attempt.totalQuizProblems ?? quizProblems.length;
    const correctCount =
      attempt.correctCount ??
      problemAttempts.filter(
        (problemAttempt) => problemAttempt.isCorrect === true,
      ).length;
    const score =
      attempt.score == null
        ? totalQuizProblems > 0
          ? Number(((correctCount / totalQuizProblems) * 100).toFixed(2))
          : 0
        : this.toNumber(attempt.score, 0);

    return {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt
        ? attempt.submittedAt.toISOString()
        : null,
      totalQuizProblems,
      correctCount,
      score,
      feedback: attempt.feedback ?? null,
      problems: quizProblems.map((problem) => {
        const answer = attemptByProblemId.get(problem.id);
        const isUnanswered = !answer;
        const selectedChoiceIds =
          problem.quizProblemType === QuizProblemType.MULTIPLE_CHOICE
            ? this.parseSelectedChoiceIds(answer?.userAnswer)
            : undefined;

        return {
          quizProblemId: problem.id,
          displayOrder: problem.displayOrder,
          problemText: problem.problemText,
          quizProblemType: problem.quizProblemType,
          difficulty: problem.difficulty,
          userAnswer: answer?.userAnswer ?? null,
          selectedChoiceIds,
          isUnanswered,
          isCorrect: isUnanswered ? false : answer.isCorrect === true,
          correctAnswer: problem.answerText,
          explanation: problem.explanation ?? null,
          feedback: isUnanswered ? null : (answer.feedback ?? null),
          choices: [...(problem.quizProblemChoices ?? [])]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((choice) => ({
              id: choice.id,
              choiceText: choice.choiceText,
              displayOrder: choice.displayOrder,
              isCorrect: choice.isCorrect,
            })),
          keywords: (problem.quizProblemKeywords ?? []).map(
            (keywordMapping) => ({
              keywordId: keywordMapping.keywordId,
              name: keywordMapping.keyword?.name ?? 'Unknown keyword',
              weight:
                keywordMapping.weight == null
                  ? null
                  : Number(Number(keywordMapping.weight).toFixed(4)),
            }),
          ),
        };
      }),
    };
  }

  private async getOwnedAttemptOrThrow(
    attemptId: string,
    userId: string,
  ): Promise<QuizAttemptEntity> {
    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId },
      select: [
        'id',
        'quizId',
        'userId',
        'status',
        'startedAt',
        'submittedAt',
        'totalQuizProblems',
        'correctCount',
        'score',
        'feedback',
      ],
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found.');
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('You do not have access to this attempt.');
    }
    return attempt;
  }

  private gradeAnswer(
    quizProblem: QuizProblemEntity,
    dto: SubmitAnswerDto,
  ): {
    isCorrect: boolean;
    userAnswerToStore: string | null;
    selectedChoiceIds?: string[];
  } {
    const userAnswer = dto.userAnswer?.trim() ?? '';

    if (quizProblem.quizProblemType === QuizProblemType.SINGLE_CHOICE) {
      if (!userAnswer) {
        throw new BadRequestException(
          'For SINGLE_CHOICE, userAnswer is required.',
        );
      }

      const choices = quizProblem.quizProblemChoices ?? [];
      const selectedChoice = choices.find((choice) => choice.id === userAnswer);
      if (!selectedChoice) {
        throw new BadRequestException(
          'For SINGLE_CHOICE, userAnswer must be a valid quiz_problem_choice.id.',
        );
      }

      const correctChoice = choices.find((choice) => choice.isCorrect);
      if (!correctChoice) {
        throw new InternalServerErrorException(
          'Quiz problem is missing the correct choice.',
        );
      }

      return {
        isCorrect: selectedChoice.id === correctChoice.id,
        userAnswerToStore: selectedChoice.id,
      };
    }

    if (quizProblem.quizProblemType === QuizProblemType.MULTIPLE_CHOICE) {
      if (!Array.isArray(dto.selectedChoiceIds)) {
        throw new BadRequestException(
          'For MULTIPLE_CHOICE, selectedChoiceIds must be provided as a UUID array.',
        );
      }
      const selectedChoiceIds = this.normalizeSelectedChoiceIds(
        dto.selectedChoiceIds,
      );

      const choices = quizProblem.quizProblemChoices ?? [];
      const allChoiceIdSet = new Set(choices.map((choice) => choice.id));
      for (const choiceId of selectedChoiceIds) {
        if (!allChoiceIdSet.has(choiceId)) {
          throw new BadRequestException(
            'For MULTIPLE_CHOICE, every selected choice must belong to the submitted quiz problem.',
          );
        }
      }

      const correctChoiceIds = choices
        .filter((choice) => choice.isCorrect)
        .map((choice) => choice.id)
        .sort();
      const normalizedSelected = [...selectedChoiceIds].sort();
      const isCorrect =
        normalizedSelected.length === correctChoiceIds.length &&
        normalizedSelected.every(
          (choiceId, index) => choiceId === correctChoiceIds[index],
        );

      return {
        isCorrect,
        userAnswerToStore: JSON.stringify(normalizedSelected),
        selectedChoiceIds: normalizedSelected,
      };
    }

    if (quizProblem.quizProblemType === QuizProblemType.SHORT_ANSWER) {
      if (!userAnswer) {
        throw new BadRequestException(
          'For SHORT_ANSWER, userAnswer is required.',
        );
      }
      return {
        isCorrect:
          this.normalizeText(userAnswer) ===
          this.normalizeText(quizProblem.answerText ?? ''),
        userAnswerToStore: userAnswer,
      };
    }

    return {
      isCorrect:
        this.normalizeText(userAnswer) ===
        this.normalizeText(quizProblem.answerText ?? ''),
      userAnswerToStore: userAnswer || null,
    };
  }

  private normalizeSelectedChoiceIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value.filter((item): item is string => typeof item === 'string'),
      ),
    ];
  }

  private parseSelectedChoiceIds(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return [];
    }
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
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
