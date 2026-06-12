import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizModule } from '../quiz/quiz.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { MockExamProblem } from './entities/mock-exam-problem.entity';
import { MockExam } from './entities/mock-exam.entity';
import { MockExamController } from './mock-exam.controller';
import { MockExamService } from './mock-exam.service';

@Module({
  imports: [
    QuizModule,
    SubjectsModule,
    TypeOrmModule.forFeature([
      MockExam,
      MockExamProblem,
      DocumentEntity,
      Keyword,
      KeywordChunkEntity,
      MasteryScore,
      QuizAttemptEntity,
    ]),
  ],
  controllers: [MockExamController],
  providers: [MockExamService],
  exports: [MockExamService, TypeOrmModule],
})
export class MockExamModule {}
