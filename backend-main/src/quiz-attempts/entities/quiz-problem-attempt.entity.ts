import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { QuizProblemEntity } from '../../quiz/entities/quiz-problem.entity';
import { QuizAttemptEntity } from './quiz-attempt.entity';

@Entity('quiz_problem_attempts')
@Unique(['quizAttemptId', 'quizProblemId'])
export class QuizProblemAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_attempt_id', type: 'uuid' })
  quizAttemptId: string;

  @Column({ name: 'quiz_problem_id', type: 'uuid' })
  quizProblemId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_answer', type: 'text', nullable: true })
  userAnswer?: string | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect?: boolean | null;

  @Column({ name: 'used_hint', type: 'boolean', default: false })
  usedHint: boolean;

  @Column({ name: 'hint_level_used', type: 'int', nullable: true })
  hintLevelUsed?: number | null;

  @Column({ name: 'elapsed_seconds', type: 'int', nullable: true })
  elapsedSeconds?: number | null;

  @Column({ type: 'text', nullable: true })
  feedback?: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date | null;

  @ManyToOne(() => QuizAttemptEntity, (quizAttempt) => quizAttempt.quizProblemAttempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_attempt_id' })
  quizAttempt: QuizAttemptEntity;

  @ManyToOne(() => QuizProblemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_problem_id' })
  quizProblem: QuizProblemEntity;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
