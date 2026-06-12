import {
  Check,
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
import { Keyword } from '../../keywords/entities/keyword.entity';

@Entity('mastery_scores')
@Unique(['userId', 'keywordId'])
@Check(`"mastery_score" >= 0 AND "mastery_score" <= 1`)
@Check(`"recent_correct_rate" IS NULL OR ("recent_correct_rate" >= 0 AND "recent_correct_rate" <= 1)`)
@Check(`"difficulty_weighted_score" IS NULL OR ("difficulty_weighted_score" >= 0 AND "difficulty_weighted_score" <= 1)`)
@Check(`"no_hint_bonus" IS NULL OR ("no_hint_bonus" >= 0 AND "no_hint_bonus" <= 1)`)
export class MasteryScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'keyword_id', type: 'uuid' })
  keywordId: string;

  @Column({ name: 'mastery_score', type: 'decimal', precision: 5, scale: 4 })
  masteryScore: number;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({
    name: 'recent_correct_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  recentCorrectRate?: number | null;

  @Column({
    name: 'difficulty_weighted_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  difficultyWeightedScore?: number | null;

  @Column({ name: 'no_hint_bonus', type: 'decimal', precision: 5, scale: 4, nullable: true })
  noHintBonus?: number | null;

  @Column({ name: 'last_attempted_at', type: 'timestamp', nullable: true })
  lastAttemptedAt?: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Keyword, (keyword) => keyword.masteryScores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keyword_id' })
  keyword: Keyword;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

