import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { QuizEntity } from '../../quiz/entities/quiz.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { User } from '../../user/user.entity';
import { MockExamProblem } from './mock-exam-problem.entity';

@Entity('mock_exams')
@Unique('UQ_mock_exams_quiz_id', ['quizId'])
export class MockExam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'quiz_problem_count', type: 'int' })
  quizProblemCount: number;

  @Column({ name: 'target_weak_keywords', type: 'boolean' })
  targetWeakKeywords: boolean;

  @Column({ name: 'generated_from_mastery', type: 'boolean' })
  generatedFromMastery: boolean;

  @OneToOne(() => QuizEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizEntity;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(
    () => MockExamProblem,
    (mockExamProblem) => mockExamProblem.mockExam,
  )
  mockExamProblems: MockExamProblem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
