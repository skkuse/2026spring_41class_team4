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
import { DocumentChunkEntity } from '../../document/entities/document-chunk.entity';
import { Keyword } from './keyword.entity';

@Entity('keyword_chunks')
@Unique('UQ_keyword_chunks_keyword_id_document_chunk_id', ['keywordId', 'documentChunkId'])
@Check(`"relevance_score" IS NULL OR ("relevance_score" >= 0 AND "relevance_score" <= 1)`)
export class KeywordChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'keyword_id', type: 'uuid' })
  keywordId: string;

  @Column({ name: 'document_chunk_id', type: 'uuid' })
  documentChunkId: string;

  @Column({ name: 'relevance_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  relevanceScore?: number | null;

  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText?: string | null;

  @ManyToOne(() => Keyword, (keyword) => keyword.keywordChunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'keyword_id' })
  keyword: Keyword;

  @ManyToOne(() => DocumentChunkEntity, (documentChunk) => documentChunk.keywordChunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_chunk_id' })
  documentChunk: DocumentChunkEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
