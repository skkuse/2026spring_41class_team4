import { DifficultyLevel } from '../enums/difficulty-level.enum';
import { QuizProblemType } from '../enums/quiz-problem-type.enum';

export const BLOOM_LEVELS = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYZE',
  'EVALUATE',
] as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const DOK_LEVELS = [1, 2, 3] as const;

export type DokLevel = (typeof DOK_LEVELS)[number];

export const QUIZ_QUESTION_TYPES_FOR_DIFFICULTY = [
  'FACT_RECALL',
  'CONCEPT_EXPLANATION',
  'APPLICATION',
  'CONCEPT_COMPARE',
  'MULTI_STEP_REASONING',
] as const;

export type QuizQuestionTypeForDifficulty =
  (typeof QUIZ_QUESTION_TYPES_FOR_DIFFICULTY)[number];

export interface DifficultyFeatures {
  conceptCount: number;
  reasoningSteps: number;
  requiresInference: boolean;
  answerExplicitInMaterial: boolean;
  hasDistractors: boolean;
  requiresComparison: boolean;
  requiresApplication: boolean;
  questionType: QuizQuestionTypeForDifficulty;
}

export interface QuizProblemAssessmentMetadata {
  bloomLevel: BloomLevel;
  dokLevel: DokLevel;
  difficultyFeatures: DifficultyFeatures;
  modelPredictedDifficulty: DifficultyLevel;
  difficultyConfidence?: number | null;
  difficultyRationale?: string | null;
  evidenceChunkIds: string[];
}

export interface GeneratedQuizProblemChoiceDto {
  choiceText: string;
  isCorrect: boolean;
  displayOrder: number;
}

export interface GeneratedQuizProblemDto extends QuizProblemAssessmentMetadata {
  problemText: string;
  quizProblemType: QuizProblemType;
  answerText: string;
  explanation: string;
  difficulty: DifficultyLevel;
  hasValidDifficultyFeatures?: boolean;
  hintLevel1?: string | null;
  hintLevel2?: string | null;
  hintLevel3?: string | null;
  keywordIds: string[];
  sourceChunkIds: string[];
  choices?: GeneratedQuizProblemChoiceDto[];
}
