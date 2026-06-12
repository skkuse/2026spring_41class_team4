import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DifficultyLevel } from '../enums/difficulty-level.enum';
import { QuizProblemType } from '../enums/quiz-problem-type.enum';
import { QuizEntity } from './quiz.entity';
import { QuizProblemChoiceEntity } from './quiz-problem-choice.entity';
import { QuizProblemKeyword } from './quiz-problem-keyword.entity';

@Entity('quiz_problems')
export class QuizProblemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @Column({ name: 'problem_text', type: 'text' })
  problemText: string;

  @Column({
    name: 'quiz_problem_type',
    type: 'enum',
    enum: QuizProblemType,
    enumName: 'quiz_problem_type',
  })
  quizProblemType: QuizProblemType;

  @Column({ name: 'answer_text', type: 'text' })
  answerText: string;

  @Column({ type: 'text', nullable: true })
  explanation?: string | null;

  @Column({
    type: 'enum',
    enum: DifficultyLevel,
    enumName: 'difficulty_level',
  })
  difficulty: DifficultyLevel;

  @Column({ name: 'hint_level_1', type: 'text', nullable: true })
  hintLevel1?: string | null;

  @Column({ name: 'hint_level_2', type: 'text', nullable: true })
  hintLevel2?: string | null;

  @Column({ name: 'hint_level_3', type: 'text', nullable: true })
  hintLevel3?: string | null;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder: number;

  @ManyToOne(() => QuizEntity, (quiz) => quiz.quizProblems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizEntity;

  @OneToMany(() => QuizProblemChoiceEntity, (choice) => choice.quizProblem)
  quizProblemChoices: QuizProblemChoiceEntity[];

  @OneToMany(
    () => QuizProblemKeyword,
    (quizProblemKeyword) => quizProblemKeyword.quizProblem,
  )
  quizProblemKeywords: QuizProblemKeyword[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

