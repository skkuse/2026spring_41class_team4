import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { QuizProblemEntity } from '../../quiz/entities/quiz-problem.entity';
import { MockExam } from './mock-exam.entity';

@Entity('mock_exam_problems')
@Unique('UQ_mock_exam_problems_mock_exam_id_quiz_problem_id', [
  'mockExamId',
  'quizProblemId',
])
export class MockExamProblem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mock_exam_id', type: 'uuid' })
  mockExamId: string;

  @Column({ name: 'quiz_problem_id', type: 'uuid' })
  quizProblemId: string;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder: number;

  @ManyToOne(() => MockExam, (mockExam) => mockExam.mockExamProblems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mock_exam_id' })
  mockExam: MockExam;

  @ManyToOne(() => QuizProblemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_problem_id' })
  quizProblem: QuizProblemEntity;
}
