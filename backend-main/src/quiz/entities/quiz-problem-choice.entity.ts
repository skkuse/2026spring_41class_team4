import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuizProblemEntity } from './quiz-problem.entity';

@Entity('quiz_problem_choices')
export class QuizProblemChoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_problem_id', type: 'uuid' })
  quizProblemId: string;

  @Column({ name: 'choice_text', type: 'text' })
  choiceText: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder: number;

  @ManyToOne(() => QuizProblemEntity, (quizProblem) => quizProblem.quizProblemChoices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_problem_id' })
  quizProblem: QuizProblemEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

