import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Keyword } from '../../keywords/entities/keyword.entity';
import { DocumentChunkEntity } from './document-chunk.entity';

@Entity('documents')
export class DocumentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'uuid', nullable: true })
  subjectId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  outputDir?: string | null;

  @Column('simple-array', { nullable: true })
  jsonFiles?: string[] | null;

  @Column('simple-array', { nullable: true })
  markdownFiles?: string[] | null;

  @Column('simple-array', { nullable: true })
  imageFiles?: string[] | null;

  @Column({ type: 'varchar', length: 20, default: 'UPLOADED' })
  analysisStatus: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';

  @Column('text', { nullable: true })
  overallSummary?: string | null;

  @Column('text', { nullable: true })
  analysisErrorMessage?: string | null;

  @Column({ default: 'uploaded' })
  generationStatus: 'uploaded' | 'queued' | 'running' | 'completed' | 'failed';

  @Column({ default: 0 })
  totalPages: number;

  @Column({ default: 0 })
  pageCount: number;

  @Column({ default: 0 })
  processedPages: number;

  @Column({ default: 0 })
  failedPages: number;

  @Column('text', { nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  generationStartedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  generationCompletedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Keyword, (keyword) => keyword.document)
  keywords: Keyword[];

  @OneToMany(() => DocumentChunkEntity, (documentChunk) => documentChunk.document)
  documentChunks: DocumentChunkEntity[];
}
