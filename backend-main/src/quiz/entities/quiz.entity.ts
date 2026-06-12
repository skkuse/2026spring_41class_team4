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
import { DocumentEntity } from '../../document/entities/document.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { User } from '../../user/user.entity';
import { QuizType } from '../enums/quiz-type.enum';
import { QuizProblemEntity } from './quiz-problem.entity';

@Entity('quiz')
export class QuizEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId?: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'quiz_type',
    type: 'enum',
    enum: QuizType,
    enumName: 'quiz_type',
  })
  quizType: QuizType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'quiz_problem_count', type: 'int', nullable: true })
  quizProblemCount?: number | null;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => DocumentEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_id' })
  document?: DocumentEntity | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => QuizProblemEntity, (quizProblem) => quizProblem.quiz)
  quizProblems: QuizProblemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

