import { DocumentPreprocessingService } from './document-preprocessing.service';

describe('DocumentPreprocessingService', () => {
  let service: DocumentPreprocessingService;

  beforeEach(() => {
    service = new DocumentPreprocessingService();
  });

  it('removes image markdown references', () => {
    const input = [
      'line 1',
      '![image 1](a.png)',
      'prefix ![image 2](b.png) suffix',
      '<img src="c.png" />',
      'line 2',
    ].join('\n');

    const output = service.removeImageMarkdown(input);
    expect(output).toContain('line 1');
    expect(output).toContain('line 2');
    expect(output).not.toContain('![image 1]');
    expect(output).not.toContain('![image 2]');
    expect(output).not.toContain('<img');
  });

  it('normalizes duplicated bullet marker', () => {
    const cleaned = service.cleanPageText('- ? text');
    expect(cleaned).toBe('- text');
  });

  it('cleans joined words in allowlist', () => {
    const cleaned = service.cleanPageText(
      'servicesare x\nservicesthat y\nsystemsare z\nsystemsthat a\nmethodsand b\nreauthentication flow',
    );
    expect(cleaned).toContain('services are x');
    expect(cleaned).toContain('services that y');
    expect(cleaned).toContain('systems are z');
    expect(cleaned).toContain('systems that a');
    expect(cleaned).toContain('methods and b');
    expect(cleaned).toContain('re-authentication flow');
  });

  it('removes empty markdown tables', () => {
    const input = ['| | | |', '|---|---|---|', '| | | |', '', 'content'].join('\n');
    const output = service.removeEmptyMarkdownTables(input);
    expect(output).toBe('content');
  });

  it('builds page heading markdown format', () => {
    const markdown = service.buildPageMarkdown({
      pageNumber: 1,
      title: 'Introduction to SE',
      cleanedText: 'Introduction to SE\nsoftware engineering',
    });

    expect(markdown).toContain('# Page 1 - Introduction to SE');
    expect(markdown).toContain('## Main Content');
    expect(markdown).toContain('## Visual Notes');
  });

  it('parses cleaned markdown into page-level chunks', () => {
    const markdown = [
      '# Page 1 - Intro',
      '',
      '## Main Content',
      '',
      '- Hello',
      '- World',
      '',
      '## Visual Notes',
      '',
      'No important diagram detected.',
      '',
      '# Page 2 - Empty Page',
      '',
      '## Main Content',
      '',
      '- (No extractable text found on this page.)',
      '',
      '## Visual Notes',
      '',
      'This page appears to contain an important visual diagram or image.',
    ].join('\n');

    const chunks = service.parseCleanedMarkdownToChunks(markdown);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      pageNumber: 1,
      heading: 'Intro',
      content: '- Hello\n- World',
      visualNote: 'No important diagram detected.',
      displayOrder: 1,
    });
    expect(chunks[1]).toMatchObject({
      pageNumber: 2,
      heading: 'Empty Page',
      content: '- (No extractable text found on this page.)',
      visualNote: 'This page appears to contain an important visual diagram or image.',
      displayOrder: 2,
    });
  });

  it('removes repeated header/footer and page indicator', () => {
    const pages = service.preprocessPages([
      {
        pageNumber: 1,
        lines: ['Introduction', '1/3', 'Line one'],
        headingLines: ['Title one'],
        headerFooterLines: ['Introduction', '1/3'],
        imageRefs: new Set<string>(),
        seenLines: new Set<string>(),
      },
      {
        pageNumber: 2,
        lines: ['Introduction', '2/3', 'Line two'],
        headingLines: ['Title two'],
        headerFooterLines: ['Introduction', '2/3'],
        imageRefs: new Set<string>(),
        seenLines: new Set<string>(),
      },
      {
        pageNumber: 3,
        lines: ['Introduction', '3/3', 'Line three'],
        headingLines: ['Title three'],
        headerFooterLines: ['Introduction', '3/3'],
        imageRefs: new Set<string>(),
        seenLines: new Set<string>(),
      },
    ]);

    for (const page of pages) {
      expect(page.cleanedText).not.toContain('Introduction');
      expect(page.cleanedText).not.toMatch(/\d\/3/);
    }
  });

  it('adds important visual note for sparse text with images', () => {
    const pages = service.preprocessPages([
      {
        pageNumber: 1,
        lines: ['diagram'],
        headingLines: ['Architecture'],
        headerFooterLines: [],
        imageRefs: new Set<string>(['images/image1.png']),
        seenLines: new Set<string>(),
      },
    ]);

    expect(pages[0].importantVisualNote).toContain('important visual diagram or image');
  });

  it('artifact-level check has no noisy patterns and has page heading', () => {
    const pages = service.preprocessPages([
      {
        pageNumber: 6,
        lines: [
          'Software Engineering',
          '- ? servicesare important',
          '6/58',
          '| | | |',
          '|---|---|---|',
          '| | | |',
        ],
        headingLines: ['Software Engineering'],
        headerFooterLines: ['6/58'],
        imageRefs: new Set<string>(['images/p6.png']),
        seenLines: new Set<string>(),
      },
    ]);

    const md = pages.map((page) => page.markdown).join('\n\n');
    expect(/!\[[^\]]*\]\([^)]+\)/.test(md)).toBe(false);
    expect(md.includes('- ?')).toBe(false);
    expect(/\|\s*\|\s*\|\s*\|\s*\n\|[-:|\s]+\n\|\s*\|\s*\|\s*\|/m.test(md)).toBe(
      false,
    );
    expect(md.includes('# Page ')).toBe(true);
    expect(pages[0]).toEqual(
      expect.objectContaining({
        pageNumber: expect.any(Number),
        rawText: expect.any(String),
        cleanedText: expect.any(String),
        markdown: expect.any(String),
        imageRefs: expect.any(Array),
      }),
    );
  });
});
