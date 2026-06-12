import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import {
  DocumentAnalysisAiService,
  DocumentChunkForAnalysis,
} from './document-analysis-ai.service';

// The service builds `new OpenAI({ apiKey })` and calls
// `client.chat.completions.create(...)`. Mock the module so one shared mock
// backs every create() call. analyzeDocument makes TWO sequential calls
// (summary, then keywords), so tests queue responses with mockResolvedValueOnce.
const createCompletion = jest.fn();
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: createCompletion } },
  })),
);

const OpenAIMock = OpenAI as unknown as jest.Mock;

const completionWith = (content: string | null) => ({
  choices: [{ message: { content } }],
});

const chunks: DocumentChunkForAnalysis[] = [
  {
    pageNumber: 1,
    heading: 'Software Process',
    content: 'The Waterfall model is a sequential design process.',
    visualNote: 'diagram of phases',
  },
];

const validKeyword = {
  name: 'Waterfall model(폭포수 모델)',
  description: '순차적 소프트웨어 개발 모델',
  importanceScore: 0.9,
  sourceRefs: [
    {
      pageNumber: 1,
      heading: 'Software Process',
      evidenceText: 'The Waterfall model is a sequential design process.',
      relevanceScore: 0.95,
    },
  ],
  isLearningObjectiveCore: true,
  appearsMultipleTimes: false,
  isPrerequisiteForOtherConcepts: true,
  isUsedInAssessment: false,
};

describe('DocumentAnalysisAiService', () => {
  const ORIGINAL_ENV = process.env;

  const buildService = (config: Record<string, string | undefined>) => {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    };
    return new DocumentAnalysisAiService(configService as never);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should be defined', () => {
    expect(buildService({ OPENAI_API_KEY: 'sk-test' })).toBeDefined();
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

    it('prefers OPENAI_ANALYSIS_MODEL over fallbacks', async () => {
      const service = buildService({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_ANALYSIS_MODEL: 'analysis-model',
        OPENAI_MODEL: 'general-model',
      });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(completionWith(JSON.stringify({ keywords: [] })));

      await service.analyzeDocument({ cleanedMarkdown: '# Doc', chunks });
      expect(createCompletion.mock.calls[0][0].model).toBe('analysis-model');
    });

    it('falls back to gpt-4.1-mini when no model env is set', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(completionWith(JSON.stringify({ keywords: [] })));

      await service.analyzeDocument({ cleanedMarkdown: '# Doc', chunks });
      expect(createCompletion.mock.calls[0][0].model).toBe('gpt-4.1-mini');
    });
  });

  describe('prompt / request construction', () => {
    it('embeds the cleaned markdown in the summary request and chunks in the keyword request', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: '요약' })),
        )
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ keywords: [validKeyword] })),
        );

      await service.analyzeDocument({
        cleanedMarkdown: '# Lecture\nWaterfall content',
        chunks,
      });

      expect(createCompletion).toHaveBeenCalledTimes(2);

      const summaryReq = createCompletion.mock.calls[0][0];
      expect(summaryReq.response_format).toEqual({ type: 'json_object' });
      expect(summaryReq.temperature).toBe(0.2);
      expect(summaryReq.messages[1].content).toContain('# Lecture');
      expect(summaryReq.messages[1].content).toContain('Waterfall content');

      const keywordReq = createCompletion.mock.calls[1][0];
      const keywordPrompt: string = keywordReq.messages[1].content;
      // Chunk content + page number + heading + visualNote serialized as JSON.
      expect(keywordPrompt).toContain('"pageNumber":1');
      expect(keywordPrompt).toContain('"heading":"Software Process"');
      expect(keywordPrompt).toContain(
        'The Waterfall model is a sequential design process.',
      );
      expect(keywordPrompt).toContain('"visualNote":"diagram of phases"');
    });
  });

  describe('successful response parsing -> result mapping', () => {
    it('maps summary and keywords into a DocumentAnalysisResult', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: '  ## 개요\n요약  ' })),
        )
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ keywords: [validKeyword] })),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });

      expect(result.overallSummary).toBe('## 개요\n요약');
      expect(result.keywords).toHaveLength(1);
      const kw = result.keywords[0];
      expect(kw.name).toBe('Waterfall model(폭포수 모델)');
      expect(kw.description).toBe('순차적 소프트웨어 개발 모델');
      expect(kw.importanceScore).toBe(0.9);
      expect(kw.sourceRefs[0].pageNumber).toBe(1);
      expect(kw.sourceRefs[0].relevanceScore).toBe(0.95);
      expect(kw.isLearningObjectiveCore).toBe(true);
      expect(kw.isPrerequisiteForOtherConcepts).toBe(true);
      expect(kw.appearsMultipleTimes).toBe(false);
    });

    it('normalizes bilingual keyword name spacing', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(
          completionWith(
            JSON.stringify({
              keywords: [
                { ...validKeyword, name: '  Waterfall model ( 폭포수 모델 ) ' },
              ],
            }),
          ),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.keywords[0].name).toBe('Waterfall model(폭포수 모델)');
    });

    it('clamps importanceScore into [0,1] and defaults missing scores', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(
          completionWith(
            JSON.stringify({
              keywords: [
                {
                  ...validKeyword,
                  importanceScore: 5,
                  sourceRefs: [{ pageNumber: 1 }],
                },
              ],
            }),
          ),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.keywords[0].importanceScore).toBe(1);
      // relevanceScore omitted -> undefined (optional score).
      expect(result.keywords[0].sourceRefs[0].relevanceScore).toBeUndefined();
    });
  });

  describe('malformed / abnormal responses', () => {
    it('returns empty summary when overallSummary is not a string', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: { not: 'string' } })),
        )
        .mockResolvedValueOnce(completionWith(JSON.stringify({ keywords: [] })));

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.overallSummary).toBe('');
    });

    it('returns empty summary/keywords for empty content bodies', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(completionWith(null))
        .mockResolvedValueOnce(completionWith(null));

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.overallSummary).toBe('');
      expect(result.keywords).toEqual([]);
    });

    it('drops keywords without a name or without sourceRefs', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(
          completionWith(
            JSON.stringify({
              keywords: [
                { ...validKeyword, name: '' }, // dropped: empty name
                { ...validKeyword, sourceRefs: [] }, // dropped: no refs
                {
                  ...validKeyword,
                  sourceRefs: [{ pageNumber: 0 }], // dropped: invalid page -> filtered -> no refs
                },
                validKeyword, // kept
              ],
            }),
          ),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.keywords).toHaveLength(1);
      expect(result.keywords[0].name).toBe('Waterfall model(폭포수 모델)');
    });

    it('drops non-object / array keyword entries', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(
          completionWith(
            JSON.stringify({
              keywords: [null, 'x', 7, [], validKeyword],
            }),
          ),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.keywords).toHaveLength(1);
    });

    it('uses an empty keyword list when keywords is not an array', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ overallSummary: 's' })),
        )
        .mockResolvedValueOnce(
          completionWith(JSON.stringify({ keywords: 'not-an-array' })),
        );

      const result = await service.analyzeDocument({
        cleanedMarkdown: '# Doc',
        chunks,
      });
      expect(result.keywords).toEqual([]);
    });

    it('throws ServiceUnavailableException when content is invalid JSON', async () => {
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockResolvedValueOnce(completionWith('}{not json'));

      await expect(
        service.analyzeDocument({ cleanedMarkdown: '# Doc', chunks }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('OpenAI API errors', () => {
    it('wraps an API error in ServiceUnavailableException (mock env true)', async () => {
      process.env.OPENAI_ALLOW_MOCK_ON_ERROR = 'true';
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockRejectedValue(new Error('rate limit'));

      await expect(
        service.analyzeDocument({ cleanedMarkdown: '# Doc', chunks }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('propagates an API error as ServiceUnavailableException (mock env false)', async () => {
      process.env.OPENAI_ALLOW_MOCK_ON_ERROR = 'false';
      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      createCompletion.mockRejectedValue(new Error('upstream down'));

      await expect(
        service.analyzeDocument({ cleanedMarkdown: '# Doc', chunks }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('upstream down'),
      });
    });
  });
});
