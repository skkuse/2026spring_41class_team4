import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { KeywordChunkEntity } from '../../keywords/entities/keyword-chunk.entity';
import { DocumentEntity } from './document.entity';

@Entity('document_chunks')
@Unique('UQ_document_chunks_document_id_page_number', ['documentId', 'pageNumber'])
@Index('IDX_document_chunks_document_id_display_order', ['documentId', 'displayOrder'])
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'page_number', type: 'int' })
  pageNumber: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  heading?: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'visual_note', type: 'text', nullable: true })
  visualNote?: string | null;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder: number;

  @Column({ name: 'token_count', type: 'int', nullable: true })
  tokenCount?: number | null;

  @ManyToOne(() => DocumentEntity, (document) => document.documentChunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: DocumentEntity;

  @OneToMany(() => KeywordChunkEntity, (keywordChunk) => keywordChunk.documentChunk)
  keywordChunks: KeywordChunkEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
