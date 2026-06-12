import { DifficultyLevel } from '../../quiz/enums/difficulty-level.enum';
import {
  calculateDifficultyWeightedScore,
  resolveDifficultyWeight,
} from './difficulty-weighted-score';

describe('difficulty weighted score', () => {
  it('uses recommended difficulty weights', () => {
    expect(resolveDifficultyWeight(DifficultyLevel.EASY)).toBe(0.6);
    expect(resolveDifficultyWeight(DifficultyLevel.MEDIUM)).toBe(0.8);
    expect(resolveDifficultyWeight(DifficultyLevel.HARD)).toBe(1);
  });

  it('returns 1.0 when all attempted problems are correct', () => {
    expect(
      calculateDifficultyWeightedScore([
        { difficulty: DifficultyLevel.EASY, isCorrect: true },
        { difficulty: DifficultyLevel.MEDIUM, isCorrect: true },
        { difficulty: DifficultyLevel.HARD, isCorrect: true },
      ]),
    ).toBe(1);
  });

  it('returns 0.0 when all attempted problems are incorrect', () => {
    expect(
      calculateDifficultyWeightedScore([
        { difficulty: DifficultyLevel.EASY, isCorrect: false },
        { difficulty: DifficultyLevel.HARD, isCorrect: false },
      ]),
    ).toBe(0);
  });

  it('uses weights for averaging rather than as the final score', () => {
    expect(
      calculateDifficultyWeightedScore([
        { difficulty: DifficultyLevel.EASY, isCorrect: true },
        { difficulty: DifficultyLevel.HARD, isCorrect: false },
      ]),
    ).toBeCloseTo(0.6 / 1.6, 6);
  });

  it('returns normalized score for mixed attempts', () => {
    expect(
      calculateDifficultyWeightedScore([
        { difficulty: DifficultyLevel.EASY, isCorrect: true },
        { difficulty: DifficultyLevel.MEDIUM, isCorrect: false },
        { difficulty: DifficultyLevel.HARD, isCorrect: true },
      ]),
    ).toBeCloseTo(1.6 / 2.4, 6);
  });
});
