import { DifficultyLevel } from '../../quiz/enums/difficulty-level.enum';

export const DIFFICULTY_WEIGHTS: Record<DifficultyLevel, number> = {
  [DifficultyLevel.EASY]: 0.6,
  [DifficultyLevel.MEDIUM]: 0.8,
  [DifficultyLevel.HARD]: 1,
};

export interface DifficultyWeightedAttempt {
  difficulty: DifficultyLevel;
  isCorrect: boolean;
}

export function calculateDifficultyWeightedScore(
  attempts: DifficultyWeightedAttempt[],
): number {
  let weightedCorrectSum = 0;
  let weightSum = 0;

  for (const attempt of attempts) {
    const weight = resolveDifficultyWeight(attempt.difficulty);
    weightSum += weight;
    if (attempt.isCorrect) {
      weightedCorrectSum += weight;
    }
  }

  if (weightSum <= 0) {
    return 0;
  }

  return clampScore(weightedCorrectSum / weightSum);
}

export function resolveDifficultyWeight(difficulty: DifficultyLevel): number {
  return (
    DIFFICULTY_WEIGHTS[difficulty] ?? DIFFICULTY_WEIGHTS[DifficultyLevel.MEDIUM]
  );
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
