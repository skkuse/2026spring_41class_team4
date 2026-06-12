import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { QuizProblemKeyword } from '../quiz/entities/quiz-problem-keyword.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizProblemAttemptEntity } from '../quiz-attempts/entities/quiz-problem-attempt.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { MasteryScore } from './entities/mastery-score.entity';
import { MasteryController } from './mastery.controller';
import { MasteryService } from './mastery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasteryScore,
      QuizAttemptEntity,
      QuizProblemAttemptEntity,
      QuizProblemKeyword,
      Keyword,
      DocumentEntity,
      Subject,
    ]),
  ],
  controllers: [MasteryController],
  providers: [MasteryService],
  exports: [MasteryService],
})
export class MasteryModule {}
