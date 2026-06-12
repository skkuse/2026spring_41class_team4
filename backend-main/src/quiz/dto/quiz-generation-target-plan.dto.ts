import { DifficultyLevel } from '../enums/difficulty-level.enum';

export interface QuizSourceChunk {
  chunkId: string;
  pageNumber: number;
  heading?: string | null;
  content: string;
  evidenceText?: string | null;
  relevanceScore?: number | null;
}

export interface QuizKeywordTarget {
  keywordId: string;
  name: string;
  description?: string | null;
  importanceScore: number;
  masteryScore: number | null;
  attempts: number;
  priorityScore: number;
  desiredQuestionCount: number;
  sourceChunkIds: string[];
}

export interface QuizDifficultyDistribution {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

export interface QuizGenerationTargetPlan {
  documentId: string;
  subjectId: string;
  userId: string;
  quizProblemCount: number;
  difficultyDistribution: QuizDifficultyDistribution;
  targets: QuizKeywordTarget[];
  sourceChunks: QuizSourceChunk[];
}

