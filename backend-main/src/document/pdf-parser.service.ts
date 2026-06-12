import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentPreprocessingService } from './document-preprocessing.service';

export interface ParsedDocumentArtifacts {
  documentId: string;
  outputDir: string;
  jsonFiles: string[];
  markdownFiles: string[];
  imageFiles: string[];
  cleanedOpenAiInputFile: string;
  totalPages?: number;
}

@Injectable()
export class PdfParserService {
  constructor(
    private readonly documentPreprocessingService: DocumentPreprocessingService,
  ) {}

  async parse(file: Express.Multer.File): Promise<ParsedDocumentArtifacts> {
    const { convert } = await import('@opendataloader/pdf');
    const jobId = randomUUID();
    const baseDir = join(tmpdir(), 'pdf-ai-tutor', jobId);
    const inputDir = join(baseDir, 'input');
    const outputDir = join(baseDir, 'output');
    const inputFilePath = join(inputDir, file.originalname);

    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputFilePath, file.buffer);

    await convert([inputFilePath], {
      outputDir,
      format: 'json,markdown',
    });

    const outputFiles = await this.collectOutputFiles(outputDir);
    const jsonFiles = outputFiles.filter((path) => path.endsWith('.json'));
    const markdownFiles = outputFiles.filter(
      (path) => path.endsWith('.md') || path.endsWith('.markdown'),
    );
    const imageFiles = outputFiles.filter((path) => {
      const lowerPath = path.toLowerCase();
      return (
        lowerPath.endsWith('.png') ||
        lowerPath.endsWith('.jpg') ||
        lowerPath.endsWith('.jpeg') ||
        lowerPath.endsWith('.webp')
      );
    });
    const preprocessResult =
      await this.documentPreprocessingService.preprocessAndWrite({
        jsonFiles,
        outputDir,
      });

    return {
      documentId: jobId,
      outputDir,
      jsonFiles,
      markdownFiles,
      imageFiles,
      cleanedOpenAiInputFile: preprocessResult.cleanedOpenAiInputFile,
      totalPages: preprocessResult.totalPages,
    };
  }

  private async collectOutputFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectOutputFiles(entryPath)));
        continue;
      }
      files.push(entryPath);
    }

    return files;
  }
}
