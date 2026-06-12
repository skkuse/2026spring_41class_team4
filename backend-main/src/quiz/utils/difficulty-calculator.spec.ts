import {
  calculateDifficulty,
  calculateFinalDifficulty,
  normalizeDifficultyFeatures,
} from './difficulty-calculator';
import { DifficultyLevel } from '../enums/difficulty-level.enum';

describe('difficulty calculator', () => {
  it('returns EASY for direct recall with explicit material evidence', () => {
    expect(
      calculateDifficulty({
        conceptCount: 1,
        reasoningSteps: 1,
        requiresInference: false,
        answerExplicitInMaterial: true,
        hasDistractors: false,
        requiresComparison: false,
        requiresApplication: false,
        questionType: 'FACT_RECALL',
      }),
    ).toBe(DifficultyLevel.EASY);
  });

  it('returns MEDIUM for simple application or reasoning', () => {
    expect(
      calculateDifficulty({
        conceptCount: 1,
        reasoningSteps: 1,
        requiresInference: false,
        answerExplicitInMaterial: true,
        hasDistractors: true,
        requiresComparison: false,
        requiresApplication: true,
        questionType: 'APPLICATION',
      }),
    ).toBe(DifficultyLevel.MEDIUM);
  });

  it('returns HARD for multi-step reasoning across multiple concepts', () => {
    expect(
      calculateDifficulty({
        conceptCount: 3,
        reasoningSteps: 3,
        requiresInference: true,
        answerExplicitInMaterial: false,
        hasDistractors: true,
        requiresComparison: true,
        requiresApplication: true,
        questionType: 'MULTI_STEP_REASONING',
      }),
    ).toBe(DifficultyLevel.HARD);
  });

  it('normalizes invalid feature values safely', () => {
    expect(
      calculateDifficulty({
        conceptCount: -3,
        reasoningSteps: Number.NaN,
        requiresInference: 'yes' as never,
        answerExplicitInMaterial: 'no' as never,
        hasDistractors: 'true' as never,
        requiresComparison: null as never,
        requiresApplication: undefined,
        questionType: 'UNKNOWN' as never,
      }),
    ).toBe(DifficultyLevel.EASY);
  });

  it('clamps numeric features before scoring', () => {
    expect(
      normalizeDifficultyFeatures({
        conceptCount: 999,
        reasoningSteps: '4.9' as never,
        questionType: 'FACT_RECALL',
      }),
    ).toEqual({
      conceptCount: 5,
      reasoningSteps: 4,
      requiresInference: false,
      answerExplicitInMaterial: true,
      hasDistractors: false,
      requiresComparison: false,
      requiresApplication: false,
      questionType: 'FACT_RECALL',
    });
  });

  it('uses calculated difficulty instead of AI-provided difficulty when features are valid', () => {
    expect(
      calculateFinalDifficulty({
        aiProvidedDifficulty: DifficultyLevel.EASY,
        hasValidDifficultyFeatures: true,
        difficultyFeatures: {
          conceptCount: 3,
          reasoningSteps: 3,
          requiresInference: true,
          answerExplicitInMaterial: false,
          hasDistractors: true,
          requiresComparison: true,
          requiresApplication: true,
          questionType: 'MULTI_STEP_REASONING',
        },
      }),
    ).toBe(DifficultyLevel.HARD);
  });

  it('falls back to valid AI-provided difficulty when features are missing or invalid', () => {
    expect(
      calculateFinalDifficulty({
        aiProvidedDifficulty: DifficultyLevel.HARD,
        hasValidDifficultyFeatures: false,
        difficultyFeatures: undefined,
      }),
    ).toBe(DifficultyLevel.HARD);
  });

  it('falls back to MEDIUM when features and AI-provided difficulty are invalid', () => {
    expect(
      calculateFinalDifficulty({
        aiProvidedDifficulty: 'NOT_A_DIFFICULTY',
        hasValidDifficultyFeatures: false,
        difficultyFeatures: null,
      }),
    ).toBe(DifficultyLevel.MEDIUM);
  });
});
