import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunkEntity } from '../document/entities/document-chunk.entity';
import { DocumentEntity } from '../document/entities/document.entity';
import { KeywordChunkEntity } from '../keywords/entities/keyword-chunk.entity';
import { Keyword } from '../keywords/entities/keyword.entity';
import { MasteryScore } from '../mastery/entities/mastery-score.entity';
import { QuizAttemptEntity } from '../quiz-attempts/entities/quiz-attempt.entity';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { QuizAiGenerationService } from './quiz-ai-generation.service';
import { QuizEntity } from './entities/quiz.entity';
import { QuizProblemChoiceEntity } from './entities/quiz-problem-choice.entity';
import { QuizProblemEntity } from './entities/quiz-problem.entity';
import { QuizProblemKeyword } from './entities/quiz-problem-keyword.entity';
import { QuizTargetSelectorService } from './quiz-target-selector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizEntity,
      QuizProblemEntity,
      QuizProblemChoiceEntity,
      QuizProblemKeyword,
      DocumentEntity,
      Keyword,
      MasteryScore,
      QuizAttemptEntity,
      KeywordChunkEntity,
      DocumentChunkEntity,
    ]),
  ],
  controllers: [QuizController],
  providers: [QuizService, QuizTargetSelectorService, QuizAiGenerationService],
  exports: [QuizService, QuizTargetSelectorService, QuizAiGenerationService],
})
export class QuizModule {}
