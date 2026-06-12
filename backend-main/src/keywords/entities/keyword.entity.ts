import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentEntity } from '../../document/entities/document.entity';
import { MasteryScore } from '../../mastery/entities/mastery-score.entity';
import { QuizProblemKeyword } from '../../quiz/entities/quiz-problem-keyword.entity';
import { KeywordChunkEntity } from './keyword-chunk.entity';

@Entity('keywords')
@Unique(['documentId', 'name'])
@Check(`"importance_score" IS NULL OR ("importance_score" >= 0 AND "importance_score" <= 1)`)
export class Keyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'importance_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  importanceScore?: number | null;

  @Column({ name: 'is_learning_objective_core', type: 'boolean', default: false })
  isLearningObjectiveCore: boolean;

  @Column({ name: 'appears_multiple_times', type: 'boolean', default: false })
  appearsMultipleTimes: boolean;

  @Column({ name: 'is_prerequisite_for_other_concepts', type: 'boolean', default: false })
  isPrerequisiteForOtherConcepts: boolean;

  @Column({ name: 'is_used_in_assessment', type: 'boolean', default: false })
  isUsedInAssessment: boolean;

  @ManyToOne(() => DocumentEntity, (document) => document.keywords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: DocumentEntity;

  @OneToMany(() => MasteryScore, (masteryScore) => masteryScore.keyword)
  masteryScores: MasteryScore[];

  @OneToMany(() => QuizProblemKeyword, (quizProblemKeyword) => quizProblemKeyword.keyword)
  quizProblemKeywords: QuizProblemKeyword[];

  @OneToMany(() => KeywordChunkEntity, (keywordChunk) => keywordChunk.keyword)
  keywordChunks: KeywordChunkEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
