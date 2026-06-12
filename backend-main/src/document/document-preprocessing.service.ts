import { Injectable } from '@nestjs/common';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PreprocessedPageDto } from './dto/preprocessed-page.dto';

interface PageAccumulator {
  pageNumber: number;
  lines: string[];
  headingLines: string[];
  headerFooterLines: string[];
  imageRefs: Set<string>;
  seenLines: Set<string>;
}

interface PreprocessInput {
  jsonFiles: string[];
  outputDir: string;
}

interface PreprocessResult {
  cleanedOpenAiInputFile: string;
  totalPages: number;
}

export interface ParsedDocumentChunk {
  pageNumber: number;
  heading: string | null;
  content: string;
  visualNote: string | null;
  displayOrder: number;
  tokenCount?: number;
}

@Injectable()
export class DocumentPreprocessingService {
  parseCleanedMarkdownToChunks(markdown: string): ParsedDocumentChunk[] {
    const normalizedMarkdown = markdown.replace(/\r\n/g, '\n');
    const pageHeadingRegex = /^#\s*Page\s+(\d+)\s*-\s*(.+?)\s*$/gim;
    const headings: Array<{
      pageNumber: number;
      heading: string | null;
      startIndex: number;
    }> = [];

    let matched = pageHeadingRegex.exec(normalizedMarkdown);
    while (matched) {
      const pageNumber = Number(matched[1]);
      const headingText = matched[2]?.trim() ?? '';
      if (Number.isInteger(pageNumber) && pageNumber > 0) {
        headings.push({
          pageNumber,
          heading: headingText.length > 0 ? headingText : null,
          startIndex: matched.index,
        });
      }
      matched = pageHeadingRegex.exec(normalizedMarkdown);
    }

    if (headings.length === 0) {
      return [];
    }

    return headings.map((heading, index) => {
      const endIndex =
        index + 1 < headings.length ? headings[index + 1].startIndex : normalizedMarkdown.length;
      const pageBlock = normalizedMarkdown.slice(heading.startIndex, endIndex).trim();
      const content = this.extractSectionBody(pageBlock, 'Main Content') ?? '';
      const visualNote = this.extractSectionBody(pageBlock, 'Visual Notes');

      return {
        pageNumber: heading.pageNumber,
        heading: heading.heading,
        content,
        visualNote,
        displayOrder: index + 1,
        tokenCount: Math.ceil(content.length / 4),
      };
    });
  }

  async preprocessAndWrite(input: PreprocessInput): Promise<PreprocessResult> {
    const pages = await this.extractPagesFromJsonFiles(input.jsonFiles);
    const cleanedPages = this.preprocessPages(pages);

    const cleanedOpenAiInputFile = join(input.outputDir, 'cleaned-openai-input.md');

    await writeFile(
      cleanedOpenAiInputFile,
      cleanedPages.map((page) => page.markdown).join('\n\n'),
      'utf8',
    );

    return {
      cleanedOpenAiInputFile,
      totalPages: cleanedPages.length,
    };
  }

  preprocessPages(accumulators: PageAccumulator[]): PreprocessedPageDto[] {
    const repeatedHeaderFooterLines = this.findRepeatedHeaderFooterLines(accumulators);

    return accumulators
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((page) => {
        const rawText = this.normalizeWhitespace(page.lines.join('\n'));
        const withoutRepeatedHeaderFooter = this.removeRepeatedHeaderFooterLines(
          rawText,
          repeatedHeaderFooterLines,
        );
        const cleanedText = this.cleanPageText(withoutRepeatedHeaderFooter);
        const title =
          this.extractPageTitle(cleanedText) ??
          this.extractPageTitle(page.headingLines.join('\n')) ??
          `Page ${page.pageNumber}`;
        const importantVisualNote = this.getImportantVisualNote(cleanedText, page.imageRefs);
        const markdown = this.buildPageMarkdown({
          pageNumber: page.pageNumber,
          title,
          cleanedText,
          importantVisualNote,
        });

        return {
          pageNumber: page.pageNumber,
          title,
          rawText,
          cleanedText,
          markdown,
          imageRefs: [...page.imageRefs],
          ...(importantVisualNote ? { importantVisualNote } : {}),
        };
      });
  }

  cleanPageText(rawText: string): string {
    let text = rawText;
    text = this.removeImageMarkdown(text);
    text = this.removePageIndicators(text);
    text = this.normalizeBullets(text);
    text = this.fixJoinedWords(text);
    text = this.removeEmptyMarkdownTables(text);
    text = this.normalizeWhitespace(text);
    return text;
  }

  extractPageTitle(text: string): string | null {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.length < 3 || line.length > 120) {
        continue;
      }
      if (line.startsWith('- ')) {
        continue;
      }
      if (/^\d+\s*\/\s*\d+$/.test(line)) {
        continue;
      }
      return line;
    }

    return null;
  }

  removeImageMarkdown(text: string): string {
    return text.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/<img[^>]*>/gi, '');
  }

  removeEmptyMarkdownTables(text: string): string {
    const lines = text.split('\n');
    const kept: string[] = [];
    let i = 0;

    while (i < lines.length) {
      if (!lines[i].includes('|')) {
        kept.push(lines[i]);
        i += 1;
        continue;
      }

      const tableBlock: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableBlock.push(lines[i]);
        i += 1;
      }

      const hasMeaningfulContent = tableBlock.some((line) => {
        const trimmed = line.replace(/\|/g, '').replace(/[-:\s]/g, '');
        return /[A-Za-z0-9]/.test(trimmed);
      });

      if (hasMeaningfulContent) {
        kept.push(...tableBlock);
      }
    }

    return kept.join('\n').trim();
  }

  buildPageMarkdown(input: {
    pageNumber: number;
    title: string;
    cleanedText: string;
    importantVisualNote?: string;
  }): string {
    const lines = input.cleanedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const contentLines =
      lines.length > 0 && lines[0].toLowerCase() === input.title.toLowerCase()
        ? lines.slice(1)
        : lines;

    const mainContent = contentLines.length
      ? contentLines
          .map((line) => line.replace(/^[-*]\s+/, '').trim())
          .map((line) => `- ${line}`)
          .join('\n')
      : '- (No extractable text found on this page.)';

    const visualNote = input.importantVisualNote ?? 'No important diagram detected.';

    return [
      `# Page ${input.pageNumber} - ${input.title}`,
      '',
      '## Main Content',
      '',
      mainContent,
      '',
      '## Visual Notes',
      '',
      visualNote,
    ].join('\n');
  }

  private async extractPagesFromJsonFiles(jsonFiles: string[]): Promise<PageAccumulator[]> {
    const pageMap = new Map<number, PageAccumulator>();

    for (const jsonFile of jsonFiles) {
      try {
        const raw = await readFile(jsonFile, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        this.walkNode(parsed, pageMap);
      } catch {
        // Skip malformed parser output file and continue.
      }
    }

    return [...pageMap.values()];
  }

  private walkNode(
    node: unknown,
    pageMap: Map<number, PageAccumulator>,
    inheritedPageNumber?: number,
    inHeaderFooter = false,
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkNode(item, pageMap, inheritedPageNumber, inHeaderFooter);
      }
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    const record = node as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.toLowerCase() : '';
    const pageNumber =
      this.parsePageNumber(record['page number']) ??
      this.parsePageNumber(record.pageNumber) ??
      this.parsePageNumber(record.page) ??
      inheritedPageNumber;
    const nextInHeaderFooter = inHeaderFooter || type === 'header' || type === 'footer';

    if (pageNumber !== undefined) {
      const page = this.getOrCreatePage(pageMap, pageNumber);
      const content = this.extractNodeText(record);
      if (content) {
        this.appendLine(page, content);
        if (nextInHeaderFooter) {
          page.headerFooterLines.push(content);
        }
        if (type.includes('heading') || type === 'title') {
          page.headingLines.push(content);
        }
      }

      const source = record.source;
      if (typeof source === 'string' && this.isImagePath(source)) {
        page.imageRefs.add(source);
      }
    }

    for (const value of Object.values(record)) {
      this.walkNode(value, pageMap, pageNumber, nextInHeaderFooter);
    }
  }

  private extractNodeText(record: Record<string, unknown>): string {
    const content = record.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    const text = record.text;
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }

    return '';
  }

  private appendLine(page: PageAccumulator, line: string): void {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized || page.seenLines.has(normalized)) {
      return;
    }

    page.seenLines.add(normalized);
    page.lines.push(normalized);
  }

  private getOrCreatePage(pageMap: Map<number, PageAccumulator>, pageNumber: number): PageAccumulator {
    const existing = pageMap.get(pageNumber);
    if (existing) {
      return existing;
    }

    const created: PageAccumulator = {
      pageNumber,
      lines: [],
      headingLines: [],
      headerFooterLines: [],
      imageRefs: new Set<string>(),
      seenLines: new Set<string>(),
    };
    pageMap.set(pageNumber, created);
    return created;
  }

  private parsePageNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const matched = value.match(/\d+/);
      if (!matched) {
        return undefined;
      }
      const parsed = Number(matched[0]);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
  }

  private isImagePath(path: string): boolean {
    const lower = path.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    );
  }

  private removePageIndicators(text: string): string {
    return text
      .split('\n')
      .filter((line) => !/^\s*\d{1,4}\s*\/\s*\d{1,4}\s*$/.test(line.trim()))
      .join('\n');
  }

  private normalizeBullets(text: string): string {
    return text
      .replace(/^\s*[-*]\s*[\u2022\u00B7\u25E6\u25AA\u25CF]+\s*/gm, '- ')
      .replace(/^\s*[\u2022\u00B7\u25E6\u25AA\u25CF]+\s+/gm, '- ')
      .replace(/^\s*-\s*[\u2022\u00B7\u25E6\u25AA\u25CF]+\s*/gm, '- ')
      .replace(/^\s*[-*]\s*\?+\s*/gm, '- ')
      .replace(/^\s*\?+\s+/gm, '- ');
  }

  private fixJoinedWords(text: string): string {
    const replacements: Array<[RegExp, string]> = [
      [/\bservicesare\b/gi, 'services are'],
      [/\bservicesthat\b/gi, 'services that'],
      [/\bsystemsare\b/gi, 'systems are'],
      [/\bsystemsthat\b/gi, 'systems that'],
      [/\bmethodsand\b/gi, 'methods and'],
      [/\breauthentication\b/gi, 're-authentication'],
    ];

    let fixed = text;
    for (const [pattern, replacement] of replacements) {
      fixed = fixed.replace(pattern, replacement);
    }

    return fixed;
  }

  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  private getImportantVisualNote(cleanedText: string, imageRefs: Set<string>): string | undefined {
    const contentLength = cleanedText.replace(/\s/g, '').length;
    if (contentLength < 80 && imageRefs.size > 0) {
      return 'This page appears to contain an important visual diagram or image. The current text extraction may be incomplete.';
    }

    return undefined;
  }

  private findRepeatedHeaderFooterLines(pages: PageAccumulator[]): Set<string> {
    const counts = new Map<string, number>();
    const threshold = Math.max(2, Math.ceil(pages.length * 0.6));

    for (const page of pages) {
      const uniqueLines = new Set(
        page.headerFooterLines
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.length <= 80),
      );

      for (const line of uniqueLines) {
        counts.set(line, (counts.get(line) ?? 0) + 1);
      }
    }

    const repeated = new Set<string>();
    for (const [line, count] of counts.entries()) {
      if (count >= threshold && !/^\d+\s*\/\s*\d+$/.test(line)) {
        repeated.add(line);
      }
    }

    return repeated;
  }

  private removeRepeatedHeaderFooterLines(text: string, repeated: Set<string>): string {
    if (repeated.size === 0) {
      return text;
    }

    return text
      .split('\n')
      .filter((line) => !repeated.has(line.trim()))
      .join('\n');
  }

  private extractSectionBody(
    pageBlock: string,
    sectionName: 'Main Content' | 'Visual Notes',
  ): string | null {
    const escapedSectionName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionHeaderRegex = new RegExp(`^##\\s*${escapedSectionName}\\s*$`, 'im');
    const sectionHeaderMatch = sectionHeaderRegex.exec(pageBlock);
    if (!sectionHeaderMatch || sectionHeaderMatch.index < 0) {
      return null;
    }

    const sectionStart = sectionHeaderMatch.index + sectionHeaderMatch[0].length;
    const remaining = pageBlock.slice(sectionStart);
    const nextSectionRegex = /^##\s+/im;
    const nextSectionMatch = nextSectionRegex.exec(remaining);
    const sectionBody =
      nextSectionMatch && nextSectionMatch.index >= 0
        ? remaining.slice(0, nextSectionMatch.index)
        : remaining;

    const trimmed = sectionBody.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

}
