import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocumentPreprocessingService } from './document-preprocessing.service';
import { PdfParserService } from './pdf-parser.service';

const fsPromisesMock = {
  mkdir: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
};

jest.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => fsPromisesMock.mkdir(...args),
  readdir: (...args: unknown[]) => fsPromisesMock.readdir(...args),
  writeFile: (...args: unknown[]) => fsPromisesMock.writeFile(...args),
}));

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'job-uuid'),
}));

const convertMock = jest.fn();
jest.mock('@opendataloader/pdf', () => ({ convert: (...args: unknown[]) => convertMock(...args) }));

type DirentLike = {
  name: string;
  isDirectory: () => boolean;
};

const fileEntry = (name: string): DirentLike => ({
  name,
  isDirectory: () => false,
});

const dirEntry = (name: string): DirentLike => ({
  name,
  isDirectory: () => true,
});

describe('PdfParserService', () => {
  let service: PdfParserService;

  const preprocessingService = {
    preprocessAndWrite: jest.fn(),
  } as unknown as jest.Mocked<DocumentPreprocessingService>;

  const baseDir = join(tmpdir(), 'pdf-ai-tutor', 'job-uuid');
  const inputDir = join(baseDir, 'input');
  const outputDir = join(baseDir, 'output');

  beforeEach(() => {
    jest.clearAllMocks();
    fsPromisesMock.mkdir.mockResolvedValue(undefined);
    fsPromisesMock.writeFile.mockResolvedValue(undefined);
    convertMock.mockResolvedValue(undefined);
    (preprocessingService.preprocessAndWrite as jest.Mock).mockResolvedValue({
      cleanedOpenAiInputFile: join(outputDir, 'cleaned.txt'),
      totalPages: 7,
    });
    service = new PdfParserService(preprocessingService);
  });

  it('writes the input file and invokes convert with output dir and format', async () => {
    fsPromisesMock.readdir.mockResolvedValue([]);
    const file = {
      originalname: 'lecture.pdf',
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File;

    await service.parse(file);

    expect(fsPromisesMock.mkdir).toHaveBeenCalledWith(inputDir, {
      recursive: true,
    });
    expect(fsPromisesMock.mkdir).toHaveBeenCalledWith(outputDir, {
      recursive: true,
    });
    expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
      join(inputDir, 'lecture.pdf'),
      file.buffer,
    );
    expect(convertMock).toHaveBeenCalledWith([join(inputDir, 'lecture.pdf')], {
      outputDir,
      format: 'json,markdown',
    });
  });

  it('classifies output files by type and delegates preprocessing', async () => {
    fsPromisesMock.readdir.mockImplementation((dir: string) => {
      if (dir === outputDir) {
        return Promise.resolve([
          fileEntry('page.json'),
          fileEntry('page.md'),
          fileEntry('notes.markdown'),
          fileEntry('fig.PNG'),
          fileEntry('photo.jpg'),
          fileEntry('photo.jpeg'),
          fileEntry('icon.webp'),
          fileEntry('ignore.txt'),
          dirEntry('sub'),
        ]);
      }
      // nested directory
      return Promise.resolve([fileEntry('nested.json')]);
    });

    const file = {
      originalname: 'lecture.pdf',
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File;

    const result = await service.parse(file);

    const nestedJson = join(outputDir, 'sub', 'nested.json');
    expect(result.documentId).toBe('job-uuid');
    expect(result.outputDir).toBe(outputDir);
    expect(result.jsonFiles).toEqual([
      join(outputDir, 'page.json'),
      nestedJson,
    ]);
    expect(result.markdownFiles).toEqual([
      join(outputDir, 'page.md'),
      join(outputDir, 'notes.markdown'),
    ]);
    expect(result.imageFiles).toEqual([
      join(outputDir, 'fig.PNG'),
      join(outputDir, 'photo.jpg'),
      join(outputDir, 'photo.jpeg'),
      join(outputDir, 'icon.webp'),
    ]);

    expect(preprocessingService.preprocessAndWrite).toHaveBeenCalledWith({
      jsonFiles: [join(outputDir, 'page.json'), nestedJson],
      outputDir,
    });
    expect(result.cleanedOpenAiInputFile).toBe(join(outputDir, 'cleaned.txt'));
    expect(result.totalPages).toBe(7);
  });

  it('propagates errors thrown by convert', async () => {
    const failure = new Error('convert failed');
    convertMock.mockRejectedValueOnce(failure);

    const file = {
      originalname: 'lecture.pdf',
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File;

    await expect(service.parse(file)).rejects.toBe(failure);
    expect(preprocessingService.preprocessAndWrite).not.toHaveBeenCalled();
  });
});
