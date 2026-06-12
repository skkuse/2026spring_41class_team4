import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateDocumentQuizDto,
  DEFAULT_LECTURE_QUIZ_PROBLEM_COUNT,
} from './dto/create-document-quiz.dto';
import { QuizService } from './quiz.service';
import { QuizTargetSelectorService } from './quiz-target-selector.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizTargetSelectorService: QuizTargetSelectorService,
  ) {}

  // TODO: Remove or disable this development-only endpoint before production release.
  @Post('documents/:documentId/quiz/preview-targets')
  previewLectureQuizTargets(
    @CurrentUser() currentUser: JwtPayload,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateDocumentQuizDto,
  ) {
    return this.quizTargetSelectorService.selectLectureQuizTargets({
      userId: currentUser.sub,
      documentId,
      quizProblemCount: dto.quizProblemCount ?? DEFAULT_LECTURE_QUIZ_PROBLEM_COUNT,
      keywordIds: dto.keywordIds,
      difficulty: dto.difficulty ?? null,
    });
  }

  @Post('documents/:documentId/quiz')
  createLectureQuiz(
    @CurrentUser() currentUser: JwtPayload,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateDocumentQuizDto,
  ) {
    return this.quizService.createLectureQuiz(currentUser.sub, documentId, dto);
  }

  @Get('documents/:documentId/quiz')
  listDocumentQuizzes(
    @CurrentUser() currentUser: JwtPayload,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.quizService.listDocumentQuizzes(currentUser.sub, documentId);
  }

  @Get('quiz/:quizId')
  getQuizForSolving(
    @CurrentUser() currentUser: JwtPayload,
    @Param('quizId', ParseUUIDPipe) quizId: string,
  ) {
    return this.quizService.getQuizForSolving(currentUser.sub, quizId);
  }
}
