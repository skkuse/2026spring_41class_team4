import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasteryModule } from '../mastery/mastery.module';
import { QuizEntity } from '../quiz/entities/quiz.entity';
import { QuizProblemEntity } from '../quiz/entities/quiz-problem.entity';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizAttemptEntity } from './entities/quiz-attempt.entity';
import { QuizProblemAttemptEntity } from './entities/quiz-problem-attempt.entity';

@Module({
  imports: [
    MasteryModule,
    TypeOrmModule.forFeature([
      QuizEntity,
      QuizProblemEntity,
      QuizAttemptEntity,
      QuizProblemAttemptEntity,
    ]),
  ],
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService],
  exports: [QuizAttemptsService],
})
export class QuizAttemptsModule {}
