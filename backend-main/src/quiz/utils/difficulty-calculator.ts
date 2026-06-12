import {
  DifficultyFeatures,
  QUIZ_QUESTION_TYPES_FOR_DIFFICULTY,
} from '../dto/generated-quiz-problem.dto';
import { DifficultyLevel } from '../enums/difficulty-level.enum';

type DifficultyFeatureInput = Partial<DifficultyFeatures> | null | undefined;

export interface FinalDifficultyInput {
  difficultyFeatures?: DifficultyFeatureInput;
  aiProvidedDifficulty?: unknown;
  hasValidDifficultyFeatures?: boolean;
}

const QUESTION_TYPE_SCORE: Record<DifficultyFeatures['questionType'], number> =
  {
    FACT_RECALL: 0,
    CONCEPT_EXPLANATION: 1,
    APPLICATION: 2,
    CONCEPT_COMPARE: 2.5,
    MULTI_STEP_REASONING: 3,
  };

export function calculateDifficulty(
  difficultyFeatures: DifficultyFeatureInput,
): DifficultyLevel {
  const features = normalizeDifficultyFeatures(difficultyFeatures);
  let score = QUESTION_TYPE_SCORE[features.questionType];

  if (features.conceptCount >= 2) {
    score += 1;
  }
  if (features.conceptCount >= 3) {
    score += 0.5;
  }
  if (features.reasoningSteps >= 2) {
    score += 1;
  }
  if (features.reasoningSteps >= 3) {
    score += 0.5;
  }
  if (features.requiresInference) {
    score += 1;
  }
  if (!features.answerExplicitInMaterial) {
    score += 1;
  }
  if (features.requiresComparison) {
    score += 0.75;
  }
  if (features.requiresApplication) {
    score += 0.75;
  }
  if (features.hasDistractors) {
    score += 0.25;
  }

  if (score >= 4) {
    return DifficultyLevel.HARD;
  }
  if (score >= 2) {
    return DifficultyLevel.MEDIUM;
  }
  return DifficultyLevel.EASY;
}

export function calculateFinalDifficulty(
  input: FinalDifficultyInput,
): DifficultyLevel {
  if (!input.difficultyFeatures || input.hasValidDifficultyFeatures === false) {
    return normalizeDifficultyFallback(input.aiProvidedDifficulty);
  }

  return calculateDifficulty(input.difficultyFeatures);
}

export function normalizeDifficultyFeatures(
  difficultyFeatures: DifficultyFeatureInput,
): DifficultyFeatures {
  return {
    conceptCount: clampPositiveInteger(
      difficultyFeatures?.conceptCount,
      1,
      5,
      1,
    ),
    reasoningSteps: clampPositiveInteger(
      difficultyFeatures?.reasoningSteps,
      1,
      5,
      1,
    ),
    requiresInference: normalizeBoolean(
      difficultyFeatures?.requiresInference,
      false,
    ),
    answerExplicitInMaterial: normalizeBoolean(
      difficultyFeatures?.answerExplicitInMaterial,
      true,
    ),
    hasDistractors: normalizeBoolean(difficultyFeatures?.hasDistractors, false),
    requiresComparison: normalizeBoolean(
      difficultyFeatures?.requiresComparison,
      false,
    ),
    requiresApplication: normalizeBoolean(
      difficultyFeatures?.requiresApplication,
      false,
    ),
    questionType: normalizeQuestionType(difficultyFeatures?.questionType),
  };
}

function clampPositiveInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : null;

  if (numericValue === null || !Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(numericValue)));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeQuestionType(
  value: unknown,
): DifficultyFeatures['questionType'] {
  if (
    typeof value === 'string' &&
    (QUIZ_QUESTION_TYPES_FOR_DIFFICULTY as readonly string[]).includes(value)
  ) {
    return value as DifficultyFeatures['questionType'];
  }
  return 'FACT_RECALL';
}

function normalizeDifficultyFallback(value: unknown): DifficultyLevel {
  if (
    value === DifficultyLevel.EASY ||
    value === DifficultyLevel.MEDIUM ||
    value === DifficultyLevel.HARD
  ) {
    return value;
  }
  return DifficultyLevel.MEDIUM;
}
