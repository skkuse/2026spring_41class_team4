import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { QuizAttemptsService } from './quiz-attempts.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Post('quiz/:quizId/attempts')
  startAttempt(
    @CurrentUser() currentUser: JwtPayload,
    @Param('quizId', ParseUUIDPipe) quizId: string,
  ) {
    return this.quizAttemptsService.startAttempt(currentUser.sub, quizId);
  }

  @Post('attempts/:attemptId/answers')
  submitAnswer(
    @CurrentUser() currentUser: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.quizAttemptsService.submitAnswer(currentUser.sub, attemptId, dto);
  }

  @Post('attempts/:attemptId/submit')
  submitAttempt(
    @CurrentUser() currentUser: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.quizAttemptsService.submitAttempt(currentUser.sub, attemptId);
  }

  @Get('attempts/:attemptId/review')
  getReview(
    @CurrentUser() currentUser: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.quizAttemptsService.getAttemptReview(currentUser.sub, attemptId);
  }
}
