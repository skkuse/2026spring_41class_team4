import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Keyword } from '../../keywords/entities/keyword.entity';
import { QuizProblemEntity } from './quiz-problem.entity';

@Entity('quiz_problem_keywords')
@Unique(['quizProblemId', 'keywordId'])
@Check(`"weight" IS NULL OR ("weight" >= 0 AND "weight" <= 1)`)
export class QuizProblemKeyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_problem_id', type: 'uuid' })
  quizProblemId: string;

  @Column({ name: 'keyword_id', type: 'uuid' })
  keywordId: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  weight?: number | null;

  @ManyToOne(() => QuizProblemEntity, (quizProblem) => quizProblem.quizProblemKeywords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_problem_id' })
  quizProblem: QuizProblemEntity;

  @ManyToOne(() => Keyword, (keyword) => keyword.quizProblemKeywords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keyword_id' })
  keyword: Keyword;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

