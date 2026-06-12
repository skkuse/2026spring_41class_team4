import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { QuizAiGenerationService } from './quiz-ai-generation.service';
import { QuizGenerationTargetPlan } from './dto/quiz-generation-target-plan.dto';
import { DifficultyLevel } from './enums/difficulty-level.enum';
import { QuizProblemType } from './enums/quiz-problem-type.enum';

// The service constructs `new OpenAI({ apiKey })` and calls
// `client.chat.completions.create(...)`. We mock the whole `openai` module so a
// single shared mock function backs every instance's create() call.
const createCompletion = jest.fn();
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: createCompletion } },
  })),
);

const OpenAIMock = OpenAI as unknown as jest.Mock;

// Helper: an OpenAI chat-completion response wrapping the given JSON string.
const completionWith = (content: string | null) => ({
  choices: [{ message: { content } }],
});

// A fully-formed problem object as the model would emit it.
const fullProblem = {
  problemText: '클로저(Closure)란 무엇입니까?',
  quizProblemType: 'SINGLE_CHOICE',
  answerText: '함수와 렉시컬 환경의 조합',
  explanation: '클로저는 함수가 선언된 환경을 기억합니다.',
  difficulty: 'EASY',
  bloomLevel: 'REMEMBER',
  dokLevel: 1,
  difficultyFeatures: {
    conceptCount: 1,
    reasoningSteps: 0,
    requiresInference: false,
    answerExplicitInMaterial: true,
    hasDistractors: true,
    requiresComparison: false,
    requiresApplication: false,
    questionType: 'FACT_RECALL',
  },
  modelPredictedDifficulty: 'EASY',
  difficultyConfidence: 0.9,
  difficultyRationale: '직접적인 정의 회상 문제',
  evidenceChunkIds: ['chunk-1'],
  hintLevel1: '함수와 관련됩니다.',
  hintLevel2: '환경을 기억합니다.',
  hintLevel3: '렉시컬 스코프를 생각하세요.',
  keywordIds: ['kw-1'],
  sourceChunkIds: ['chunk-1'],
  choices: [
    { choiceText: '함수와 렉시컬 환경의 조합', isCorrect: true, displayOrder: 1 },
    { choiceText: '단순한 전역 변수', isCorrect: false, displayOrder: 2 },
    { choiceText: '비동기 콜백', isCorrect: false, displayOrder: 3 },
    { choiceText: '클래스 인스턴스', isCorrect: false, displayOrder: 4 },
  ],
};

const buildPlan = (
  overrides: Partial<QuizGenerationTargetPlan> = {},
): QuizGenerationTargetPlan => ({
  documentId: 'doc-1',
  subjectId: 'subj-1',
  userId: 'user-1',
  quizProblemCount: 1,
  difficultyDistribution: { easyCount: 1, mediumCount: 0, hardCount: 0 },
  targets: [
    {
      keywordId: 'kw-1',
      name: 'Closure',
      description: '클로저 개념',
      importanceScore: 0.8,
      masteryScore: null,
      attempts: 0,
      priorityScore: 1,
      desiredQuestionCount: 1,
      sourceChunkIds: ['chunk-1'],
    },
  ],
  sourceChunks: [
    {
      chunkId: 'chunk-1',
      pageNumber: 3,
      heading: 'Closures',
      content: '클로저는 함수와 렉시컬 환경의 조합이다.',
    },
  ],
  ...overrides,
});

describe('QuizAiGenerationService', () => {
  const ORIGINAL_ENV = process.env;

  const buildService = (config: Record<string, string | undefined>) => {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    };
    return new QuizAiGenerationService(configService as never);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should be defined', () => {
    const service = buildService({ OPENAI_API_KEY: 'sk-test' });
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('throws when OPENAI_API_KEY is missing', () => {
      expect(() => buildService({ OPENAI_API_KEY: undefined })).toThrow(
        InternalServerErrorException,
      );
      expect(OpenAIMock).not.toHaveBeenCalled();
    });

    it('passes the configured apiKey to the OpenAI client', () => {
      buildService({ OPENAI_API_KEY: 'sk-test' });
      expect(OpenAIMock).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    });

    it('prefers OPENAI_QUIZ_MODEL over fallbacks', async () => {
      const service = buildService({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_QUIZ_MODEL: 'quiz-model',
        OPENAI_MODEL: 'general-model',
      });
      createCompletion.mockResolvedValue(
        completionWith(JSON.stringify({ problems: [] })),
      );
      await service.generateLectureQuiz(buildPlan());
      expect(createCompletion.mock.calls[0][0].model).toBe('quiz-model');
    });

    it('falls back to gpt-4.1-mini when no model env is set', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(JSON.stringify({ problems: [] })),
      );
      await service.generateLectureQuiz(buildPlan());
      expect(createCompletion.mock.calls[0][0].model).toBe('gpt-4.1-mini');
    });
  });

  describe('input validation', () => {
    it('rejects an empty targets array without calling OpenAI', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      await expect(
        service.generateLectureQuiz(buildPlan({ targets: [] })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createCompletion).not.toHaveBeenCalled();
    });

    it('rejects an empty sourceChunks array without calling OpenAI', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      await expect(
        service.generateLectureQuiz(buildPlan({ sourceChunks: [] })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createCompletion).not.toHaveBeenCalled();
    });
  });

  describe('prompt / request construction', () => {
    it('reflects plan counts, targets and chunk content in the request', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(JSON.stringify({ problems: [] })),
      );

      await service.generateLectureQuiz(buildPlan());

      const request = createCompletion.mock.calls[0][0];
      expect(request.response_format).toEqual({ type: 'json_object' });
      expect(request.temperature).toBe(0.3);
      expect(request.messages[0].role).toBe('system');
      const userPrompt: string = request.messages[1].content;
      // Input plan is embedded in the prompt.
      expect(userPrompt).toContain('"quizProblemCount":1');
      expect(userPrompt).toContain('"keywordId":"kw-1"');
      expect(userPrompt).toContain('"chunkId":"chunk-1"');
      expect(userPrompt).toContain('클로저는 함수와 렉시컬 환경의 조합이다.');
      expect(userPrompt).toContain('"easyCount":1');
    });
  });

  describe('successful response parsing -> DTO mapping', () => {
    it('maps a full model problem into a GeneratedQuizProblemDto', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(JSON.stringify({ problems: [fullProblem] })),
      );

      const result = await service.generateLectureQuiz(buildPlan());

      expect(result).toHaveLength(1);
      const problem = result[0];
      expect(problem.problemText).toBe('클로저(Closure)란 무엇입니까?');
      expect(problem.quizProblemType).toBe(QuizProblemType.SINGLE_CHOICE);
      expect(problem.answerText).toBe('함수와 렉시컬 환경의 조합');
      expect(problem.difficulty).toBe(DifficultyLevel.EASY);
      expect(problem.bloomLevel).toBe('REMEMBER');
      expect(problem.dokLevel).toBe(1);
      expect(problem.modelPredictedDifficulty).toBe(DifficultyLevel.EASY);
      expect(problem.difficultyConfidence).toBe(0.9);
      expect(problem.hasValidDifficultyFeatures).toBe(true);
      expect(problem.keywordIds).toEqual(['kw-1']);
      expect(problem.sourceChunkIds).toEqual(['chunk-1']);
      expect(problem.evidenceChunkIds).toEqual(['chunk-1']);
      expect(problem.choices).toHaveLength(4);
    });

    it('trims strings and clamps difficultyConfidence into [0,1]', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({
            problems: [
              {
                ...fullProblem,
                problemText: '  공백 포함 문제  ',
                difficultyConfidence: 5,
              },
            ],
          }),
        ),
      );

      const [problem] = await service.generateLectureQuiz(buildPlan());
      expect(problem.problemText).toBe('공백 포함 문제');
      expect(problem.difficultyConfidence).toBe(1);
    });

    it('sorts choices by displayOrder', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({
            problems: [
              {
                ...fullProblem,
                choices: [
                  { choiceText: 'D', isCorrect: false, displayOrder: 4 },
                  { choiceText: 'A', isCorrect: true, displayOrder: 1 },
                  { choiceText: 'C', isCorrect: false, displayOrder: 3 },
                  { choiceText: 'B', isCorrect: false, displayOrder: 2 },
                ],
              },
            ],
          }),
        ),
      );

      const [problem] = await service.generateLectureQuiz(buildPlan());
      expect(problem.choices?.map((c) => c.choiceText)).toEqual([
        'A',
        'B',
        'C',
        'D',
      ]);
    });

    it('omits choices for SHORT_ANSWER problems', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({
            problems: [
              {
                ...fullProblem,
                quizProblemType: 'SHORT_ANSWER',
                choices: [
                  { choiceText: 'x', isCorrect: true, displayOrder: 1 },
                ],
              },
            ],
          }),
        ),
      );

      const [problem] = await service.generateLectureQuiz(buildPlan());
      expect(problem.quizProblemType).toBe(QuizProblemType.SHORT_ANSWER);
      expect(problem.choices).toBeUndefined();
    });

    it('falls back to evidenceChunkIds when sourceChunkIds is missing', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      const { sourceChunkIds, ...withoutSource } = fullProblem;
      void sourceChunkIds;
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({
            problems: [{ ...withoutSource, evidenceChunkIds: ['chunk-9'] }],
          }),
        ),
      );

      const [problem] = await service.generateLectureQuiz(buildPlan());
      expect(problem.sourceChunkIds).toEqual(['chunk-9']);
      expect(problem.evidenceChunkIds).toEqual(['chunk-9']);
    });
  });

  describe('malformed / abnormal responses', () => {
    it('returns an empty array when the model returns no problems array', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(JSON.stringify({ unexpected: true })),
      );

      const result = await service.generateLectureQuiz(buildPlan());
      expect(result).toEqual([]);
    });

    it('treats an empty content body as an empty result', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(completionWith(null));

      const result = await service.generateLectureQuiz(buildPlan());
      expect(result).toEqual([]);
    });

    it('drops non-object problem entries but keeps valid ones', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({ problems: [null, 'garbage', 42, fullProblem] }),
        ),
      );

      const result = await service.generateLectureQuiz(buildPlan());
      expect(result).toHaveLength(1);
    });

    it('applies safe defaults for unknown enum / missing-feature values', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(
        completionWith(
          JSON.stringify({
            problems: [
              {
                problemText: '문제',
                quizProblemType: 'NOT_A_TYPE',
                answerText: '답',
                explanation: '설명',
                difficulty: 'WHATEVER',
                bloomLevel: 'NONSENSE',
                dokLevel: 99,
                evidenceChunkIds: ['chunk-1'],
                keywordIds: ['kw-1'],
                sourceChunkIds: ['chunk-1'],
              },
            ],
          }),
        ),
      );

      const [problem] = await service.generateLectureQuiz(buildPlan());
      // Unknown type defaults to SINGLE_CHOICE, difficulty to MEDIUM,
      // bloom to UNDERSTAND, dok to 2.
      expect(problem.quizProblemType).toBe(QuizProblemType.SINGLE_CHOICE);
      expect(problem.difficulty).toBe(DifficultyLevel.MEDIUM);
      expect(problem.bloomLevel).toBe('UNDERSTAND');
      expect(problem.dokLevel).toBe(2);
      // Missing difficultyFeatures object -> flagged invalid but normalized.
      expect(problem.hasValidDifficultyFeatures).toBe(false);
      expect(problem.difficultyFeatures.conceptCount).toBe(1);
      expect(problem.difficultyConfidence).toBeNull();
    });

    it('throws ServiceUnavailableException when content is not valid JSON', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValue(completionWith('not-json{{{'));

      await expect(
        service.generateLectureQuiz(buildPlan()),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('OpenAI API errors', () => {
    it('wraps an API error in ServiceUnavailableException (mock env true)', async () => {
      process.env.OPENAI_ALLOW_MOCK_ON_ERROR = 'true';
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockRejectedValue(new Error('rate limit'));

      await expect(
        service.generateLectureQuiz(buildPlan()),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('propagates an API error as ServiceUnavailableException (mock env false)', async () => {
      process.env.OPENAI_ALLOW_MOCK_ON_ERROR = 'false';
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockRejectedValue(new Error('upstream down'));

      await expect(
        service.generateLectureQuiz(buildPlan()),
      ).rejects.toMatchObject({ message: expect.stringContaining('upstream down') });
    });
  });
});
