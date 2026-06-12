import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  BLOOM_LEVELS,
  DifficultyFeatures,
  DOK_LEVELS,
  GeneratedQuizProblemDto,
  QUIZ_QUESTION_TYPES_FOR_DIFFICULTY,
} from './dto/generated-quiz-problem.dto';
import { QuizGenerationTargetPlan } from './dto/quiz-generation-target-plan.dto';
import { DifficultyLevel } from './enums/difficulty-level.enum';
import { QuizProblemType } from './enums/quiz-problem-type.enum';

@Injectable()
export class QuizAiGenerationService {
  private readonly logger = new Logger(QuizAiGenerationService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logRawResponse: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured.',
      );
    }

    this.client = new OpenAI({ apiKey });
    this.model =
      this.configService.get<string>('OPENAI_QUIZ_MODEL') ??
      this.configService.get<string>('OPENAI_MODEL') ??
      this.configService.get<string>('OPENAI_ANALYSIS_MODEL') ??
      'gpt-4.1-mini';
    this.logRawResponse =
      this.configService.get<string>('QUIZ_AI_LOG_RAW_RESPONSE') === 'true';
  }

  async generateLectureQuiz(
    plan: QuizGenerationTargetPlan,
  ): Promise<GeneratedQuizProblemDto[]> {
    if (plan.targets.length === 0) {
      throw new BadRequestException(
        'Quiz target plan must include at least one target.',
      );
    }
    if (plan.sourceChunks.length === 0) {
      throw new BadRequestException(
        'Quiz target plan must include source chunks.',
      );
    }

    const prompt = this.buildLectureQuizPrompt(plan);
    const parsed = await this.runJsonCompletion(prompt);
    const rawProblems = Array.isArray(parsed.problems) ? parsed.problems : [];
    const generatedProblems = rawProblems
      .map((item) => this.normalizeGeneratedProblem(item))
      .filter((item): item is GeneratedQuizProblemDto => item != null);

    return generatedProblems;
  }

  private buildLectureQuizPrompt(plan: QuizGenerationTargetPlan): string {
    const input = {
      quizProblemCount: plan.quizProblemCount,
      difficultyDistribution: plan.difficultyDistribution,
      targets: plan.targets.map((target) => ({
        keywordId: target.keywordId,
        name: target.name,
        description: target.description ?? null,
        desiredQuestionCount: target.desiredQuestionCount,
        sourceChunkIds: target.sourceChunkIds,
      })),
      sourceChunks: plan.sourceChunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        pageNumber: chunk.pageNumber,
        heading: chunk.heading ?? null,
        content: chunk.content,
      })),
    };

    return [
      'You are a Korean academic quiz generator.',
      'Generate quiz problems ONLY from the provided sourceChunks.',
      'Do not use outside knowledge.',
      'Return JSON only. No markdown, no prose.',
      'Output schema:',
      '{"problems":[{"problemText":string,"quizProblemType":"SINGLE_CHOICE"|"MULTIPLE_CHOICE"|"SHORT_ANSWER","answerText":string,"explanation":string,"difficulty":"EASY"|"MEDIUM"|"HARD","bloomLevel":"REMEMBER"|"UNDERSTAND"|"APPLY"|"ANALYZE"|"EVALUATE","dokLevel":1|2|3,"difficultyFeatures":{"conceptCount":number,"reasoningSteps":number,"requiresInference":boolean,"answerExplicitInMaterial":boolean,"hasDistractors":boolean,"requiresComparison":boolean,"requiresApplication":boolean,"questionType":"FACT_RECALL"|"CONCEPT_EXPLANATION"|"APPLICATION"|"CONCEPT_COMPARE"|"MULTI_STEP_REASONING"},"modelPredictedDifficulty":"EASY"|"MEDIUM"|"HARD","difficultyConfidence":number|null,"difficultyRationale":string|null,"evidenceChunkIds":[string],"hintLevel1":string,"hintLevel2":string,"hintLevel3":string,"keywordIds":[string],"sourceChunkIds":[string],"choices":[{"choiceText":string,"isCorrect":boolean,"displayOrder":number}]}]}',
      'Rules:',
      '- problems length must equal quizProblemCount.',
      '- difficultyDistribution specifies exact required counts for EASY, MEDIUM, HARD.',
      '- You must generate exactly easyCount EASY, mediumCount MEDIUM, and hardCount HARD problems.',
      '- The sum of generated problems by difficulty must exactly match quizProblemCount.',
      '- Use Korean for problemText, choices, explanation, and hints. Technical terms may remain in English with Korean explanation.',
      '- Use the Bloom/DOK/ECD/AIG item model for every problem.',
      '- Bloom Taxonomy controls cognitive level; Webb DOK controls reasoning depth.',
      '- Evidence-Centered Design rule: each problem must produce evidence that the learner understands one or more target keywords.',
      '- Automatic Item Generation rule: fill the structured output schema instead of generating a free-form question.',
      '- Generate quiz problems only from provided sourceChunks; do not introduce facts, examples, or definitions outside those chunks.',
      '- Every problem must include at least one keywordId and sourceChunkId from provided IDs.',
      '- Every problem must include at least one evidenceChunkId from provided source chunk IDs.',
      '- keywordIds are the target keyword IDs assessed by the quiz problem.',
      '- sourceChunkIds are all source chunk IDs used to generate the quiz problem.',
      '- evidenceChunkIds are the subset of sourceChunkIds that directly supports the correct answer and explanation.',
      '- evidenceChunkIds must be selected only from sourceChunkIds.',
      '- sourceChunkIds and evidenceChunkIds may be identical when all source chunks directly support the answer.',
      '- Every problem must be grounded in sourceChunks listed in sourceChunkIds.',
      '- evidenceChunkIds must identify the sourceChunks that directly support the answer.',
      '- bloomLevel must be one of REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE.',
      '- dokLevel must be 1, 2, or 3.',
      '- difficultyFeatures must describe the cognitive and evidence features used to estimate difficulty.',
      '- modelPredictedDifficulty is only your estimate; the server will calculate final stored difficulty from difficultyFeatures.',
      '- The difficulty field and modelPredictedDifficulty must still match the requested difficultyDistribution.',
      '- difficultyConfidence must be between 0 and 1.',
      '- difficultyRationale must be a short Korean explanation of the predicted difficulty.',
      '- EASY mapping: bloomLevel REMEMBER or UNDERSTAND; dokLevel 1; conceptCount 1; reasoningSteps 0 or 1; answerExplicitInMaterial true; questionType FACT_RECALL or CONCEPT_EXPLANATION.',
      '- EASY problems should be direct recall, recognition, definition, or simple understanding grounded in explicit chunk text.',
      '- MEDIUM mapping: bloomLevel UNDERSTAND, APPLY, or simple ANALYZE; dokLevel 2; conceptCount 1 or 2; reasoningSteps 1 or 2; may require simple inference, application, or comparison.',
      '- MEDIUM problems should require basic reasoning, relationship explanation, simple application, or simple comparison.',
      '- HARD mapping: bloomLevel ANALYZE or EVALUATE; dokLevel 3; conceptCount 2 or more; reasoningSteps 2 or more; requires inference, comparison, application, or multi-step reasoning.',
      '- HARD problems should require strategic reasoning across multiple concepts or evidence chunks.',
      '- HARD problems must not be simple definition questions, direct recall questions, or simple "which is not included" questions.',
      '- HARD difficultyFeatures.reasoningSteps must be 2 or more.',
      '- HARD difficultyFeatures must set at least one of requiresInference, requiresComparison, requiresApplication to true, or set questionType to MULTI_STEP_REASONING.',
      '- If a target keyword requires multiple questions, vary angle across definition, understanding, comparison, process/order, application/scenario.',
      '- SINGLE_CHOICE must have exactly 4 choices and exactly 1 correct choice.',
      '- SINGLE_CHOICE answerText must exactly equal the choiceText where isCorrect is true.',
      '- MULTIPLE_CHOICE must have exactly 4 choices.',
      '- MULTIPLE_CHOICE may have zero, one, or multiple correct choices.',
      '- MULTIPLE_CHOICE problemText must not reveal the number of correct choices.',
      '- MULTIPLE_CHOICE problemText should use wording such as "Select all that apply" or "Choose all correct statements".',
      '- MULTIPLE_CHOICE answerText must list exactly all choiceText values where isCorrect is true.',
      '- MULTIPLE_CHOICE answerText values must be separated by comma when there are one or more correct choices.',
      '- MULTIPLE_CHOICE answerText must be an empty string if there are no correct choices.',
      '- MULTIPLE_CHOICE answerText must not include any value that is not present in choices.',
      '- Distractors must be plausible misconceptions grounded in the provided lecture chunks.',
      '- Distractors must not be obviously irrelevant.',
      '- Do not use absurd distractors such as colors, unrelated administrative tasks, or options that can be eliminated by common sense alone.',
      '- SHORT_ANSWER can omit choices.',
      '- Do not generate essay-style descriptive questions.',
      '- Do not generate open-ended explanation questions.',
      '- Do not generate questions that require the learner to answer with a full sentence.',
      '- SHORT_ANSWER must ask for a specific term, name, number, acronym, keyword, or exact short phrase.',
      '- SHORT_ANSWER answerText must be a concise term, number, name, acronym, keyword, or short phrase.',
      '- SHORT_ANSWER answerText must not be a full sentence.',
      '- SHORT_ANSWER problemText must not ask for explanation, reason, process description, meaning description, or conceptual description.',
      '- Do not use SHORT_ANSWER for questions starting with or implying "설명하시오", "서술하시오", "왜", "어떻게", "무엇을 의미", "무엇을 확인", "어떤 과정", "어떤 이유", "차이점은 무엇".',
      '- If the expected answer could naturally be written as a sentence, generate the problem as SINGLE_CHOICE instead of SHORT_ANSWER.',
      '- For SHORT_ANSWER, prefer term-identification questions such as "무엇이라고 합니까?", "용어는 무엇입니까?", "명칭은 무엇입니까?", "약어는 무엇입니까?", "숫자는 얼마입니까?".',
      '- For SHORT_ANSWER, the answer should be directly extractable from the provided sourceChunks.',
      '- Concept understanding, definition interpretation, comparison, process/order, and scenario/application questions should usually be SINGLE_CHOICE or MULTIPLE_CHOICE, not SHORT_ANSWER.',
      '- problemText, answerText, explanation must not be empty.',
      '',
      'Input JSON:',
      JSON.stringify(input),
    ].join('\n');
  }

  private async runJsonCompletion(
    prompt: string,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      if (this.logRawResponse) {
        this.logger.log(`OpenAI quiz raw response: ${raw}`);
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new ServiceUnavailableException(
        `OpenAI quiz generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private normalizeGeneratedProblem(
    value: unknown,
  ): GeneratedQuizProblemDto | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const item = value as Record<string, unknown>;
    const quizProblemType = this.normalizeQuizProblemType(item.quizProblemType);
    const difficulty = this.normalizeDifficulty(item.difficulty);
    const sourceChunkIds = this.normalizeStringArray(item.sourceChunkIds);
    const providedEvidenceChunkIds = this.normalizeStringArray(
      item.evidenceChunkIds,
    );
    const normalizedSourceChunkIds =
      sourceChunkIds.length > 0 ? sourceChunkIds : providedEvidenceChunkIds;
    const evidenceChunkIds =
      providedEvidenceChunkIds.length > 0
        ? providedEvidenceChunkIds
        : normalizedSourceChunkIds;

    return {
      problemText: this.normalizeString(item.problemText),
      quizProblemType,
      answerText: this.normalizeString(item.answerText),
      explanation: this.normalizeString(item.explanation),
      difficulty,
      hasValidDifficultyFeatures: this.hasValidDifficultyFeatures(
        item.difficultyFeatures,
      ),
      bloomLevel: this.normalizeBloomLevel(item.bloomLevel),
      dokLevel: this.normalizeDokLevel(item.dokLevel),
      difficultyFeatures: this.normalizeDifficultyFeatures(
        item.difficultyFeatures,
        quizProblemType,
      ),
      modelPredictedDifficulty: this.normalizeDifficulty(
        item.modelPredictedDifficulty ?? difficulty,
      ),
      difficultyConfidence: this.normalizeConfidence(item.difficultyConfidence),
      difficultyRationale: this.normalizeNullableString(
        item.difficultyRationale,
      ),
      evidenceChunkIds,
      hintLevel1: this.normalizeNullableString(item.hintLevel1),
      hintLevel2: this.normalizeNullableString(item.hintLevel2),
      hintLevel3: this.normalizeNullableString(item.hintLevel3),
      keywordIds: this.normalizeStringArray(item.keywordIds),
      sourceChunkIds: normalizedSourceChunkIds,
      choices:
        quizProblemType === QuizProblemType.SHORT_ANSWER
          ? undefined
          : this.normalizeChoiceArray(item.choices),
    };
  }

  private normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return [
      ...new Set(
        value
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim()),
      ),
    ].filter((item) => item.length > 0);
  }

  private normalizeChoiceArray(
    value: unknown,
  ): GeneratedQuizProblemDto['choices'] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
      .map((choice, index) => ({
        choiceText: this.normalizeString(choice.choiceText),
        isCorrect: choice.isCorrect === true,
        displayOrder: this.normalizeDisplayOrder(
          choice.displayOrder,
          index + 1,
        ),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private normalizeDisplayOrder(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return fallback;
  }

  private normalizePositiveInteger(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return fallback;
  }

  private normalizeBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private normalizeQuizProblemType(value: unknown): QuizProblemType {
    if (typeof value === 'string') {
      if (value === QuizProblemType.SINGLE_CHOICE) {
        return QuizProblemType.SINGLE_CHOICE;
      }
      if (value === QuizProblemType.MULTIPLE_CHOICE) {
        return QuizProblemType.MULTIPLE_CHOICE;
      }
      if (value === QuizProblemType.SHORT_ANSWER) {
        return QuizProblemType.SHORT_ANSWER;
      }
    }
    return QuizProblemType.SINGLE_CHOICE;
  }

  private normalizeBloomLevel(
    value: unknown,
  ): GeneratedQuizProblemDto['bloomLevel'] {
    if (
      typeof value === 'string' &&
      (BLOOM_LEVELS as readonly string[]).includes(value)
    ) {
      return value as GeneratedQuizProblemDto['bloomLevel'];
    }
    return 'UNDERSTAND';
  }

  private normalizeDokLevel(
    value: unknown,
  ): GeneratedQuizProblemDto['dokLevel'] {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : null;

    if (
      numericValue !== null &&
      (DOK_LEVELS as readonly number[]).includes(numericValue)
    ) {
      return numericValue as GeneratedQuizProblemDto['dokLevel'];
    }
    return 2;
  }

  private normalizeDifficultyFeatures(
    value: unknown,
    quizProblemType: QuizProblemType,
  ): DifficultyFeatures {
    const item =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const defaultQuestionType =
      quizProblemType === QuizProblemType.SHORT_ANSWER
        ? 'FACT_RECALL'
        : 'CONCEPT_EXPLANATION';

    return {
      conceptCount: this.normalizePositiveInteger(item.conceptCount, 1),
      reasoningSteps: this.normalizePositiveInteger(item.reasoningSteps, 1),
      requiresInference: this.normalizeBoolean(item.requiresInference, false),
      answerExplicitInMaterial: this.normalizeBoolean(
        item.answerExplicitInMaterial,
        true,
      ),
      hasDistractors: this.normalizeBoolean(
        item.hasDistractors,
        quizProblemType !== QuizProblemType.SHORT_ANSWER,
      ),
      requiresComparison: this.normalizeBoolean(item.requiresComparison, false),
      requiresApplication: this.normalizeBoolean(
        item.requiresApplication,
        false,
      ),
      questionType: this.normalizeQuestionType(
        item.questionType,
        defaultQuestionType,
      ),
    };
  }

  private hasValidDifficultyFeatures(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const item = value as Record<string, unknown>;
    return (
      this.isIntegerLike(item.conceptCount, 1) &&
      this.isIntegerLike(item.reasoningSteps, 0) &&
      typeof item.requiresInference === 'boolean' &&
      typeof item.answerExplicitInMaterial === 'boolean' &&
      typeof item.hasDistractors === 'boolean' &&
      typeof item.requiresComparison === 'boolean' &&
      typeof item.requiresApplication === 'boolean' &&
      typeof item.questionType === 'string' &&
      (QUIZ_QUESTION_TYPES_FOR_DIFFICULTY as readonly string[]).includes(
        item.questionType,
      )
    );
  }

  private isIntegerLike(value: unknown, minimum: number): boolean {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : null;

    return (
      numericValue !== null &&
      Number.isInteger(numericValue) &&
      numericValue >= minimum
    );
  }

  private normalizeQuestionType(
    value: unknown,
    fallback: DifficultyFeatures['questionType'],
  ): DifficultyFeatures['questionType'] {
    if (
      typeof value === 'string' &&
      (QUIZ_QUESTION_TYPES_FOR_DIFFICULTY as readonly string[]).includes(value)
    ) {
      return value as DifficultyFeatures['questionType'];
    }
    return fallback;
  }

  private normalizeConfidence(value: unknown): number | null {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : null;

    if (numericValue === null || !Number.isFinite(numericValue)) {
      return null;
    }
    return Math.min(1, Math.max(0, numericValue));
  }

  private normalizeDifficulty(value: unknown): DifficultyLevel {
    if (typeof value === 'string') {
      if (value === DifficultyLevel.EASY) {
        return DifficultyLevel.EASY;
      }
      if (value === DifficultyLevel.MEDIUM) {
        return DifficultyLevel.MEDIUM;
      }
      if (value === DifficultyLevel.HARD) {
        return DifficultyLevel.HARD;
      }
    }
    return DifficultyLevel.MEDIUM;
  }
}
