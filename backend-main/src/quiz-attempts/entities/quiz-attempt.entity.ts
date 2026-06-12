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
import { User } from '../../user/user.entity';
import { QuizEntity } from '../../quiz/entities/quiz.entity';
import { AttemptStatus } from '../enums/attempt-status.enum';
import { QuizProblemAttemptEntity } from './quiz-problem-attempt.entity';

@Entity('quiz_attempts')
export class QuizAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: AttemptStatus,
    enumName: 'attempt_status',
  })
  status: AttemptStatus;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date | null;

  @Column({ name: 'total_quiz_problems', type: 'int', nullable: true })
  totalQuizProblems?: number | null;

  @Column({ name: 'correct_count', type: 'int', nullable: true })
  correctCount?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score?: number | null;

  @Column({ type: 'text', nullable: true })
  feedback?: string | null;

  @ManyToOne(() => QuizEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizEntity;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(
    () => QuizProblemAttemptEntity,
    (quizProblemAttempt) => quizProblemAttempt.quizAttempt,
  )
  quizProblemAttempts: QuizProblemAttemptEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
