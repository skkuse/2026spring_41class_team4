import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { DocumentFileStorageService } from './document-file-storage.service';

const fsPromisesMock = {
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
};

jest.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => fsPromisesMock.mkdir(...args),
  unlink: (...args: unknown[]) => fsPromisesMock.unlink(...args),
  writeFile: (...args: unknown[]) => fsPromisesMock.writeFile(...args),
}));

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'fixed-uuid'),
}));

describe('DocumentFileStorageService', () => {
  let service: DocumentFileStorageService;
  const uploadRoot = '/tmp/test-uploads';
  const documentDir = join(uploadRoot, 'documents');

  const configService = {
    get: jest.fn((key: string) => (key === 'UPLOAD_ROOT' ? uploadRoot : undefined)),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    fsPromisesMock.mkdir.mockResolvedValue(undefined);
    fsPromisesMock.writeFile.mockResolvedValue(undefined);
    fsPromisesMock.unlink.mockResolvedValue(undefined);
    service = new DocumentFileStorageService(configService);
  });

  describe('savePdf', () => {
    it('creates the upload directory, writes the file and returns the public url', async () => {
      const file = {
        originalname: 'report.pdf',
        buffer: Buffer.from('pdf-bytes'),
      } as Express.Multer.File;

      const result = await service.savePdf(file);

      expect(fsPromisesMock.mkdir).toHaveBeenCalledWith(documentDir, {
        recursive: true,
      });
      expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
        join(documentDir, 'fixed-uuid.pdf'),
        file.buffer,
      );
      expect(result).toEqual({
        fileUrl: '/uploads/documents/fixed-uuid.pdf',
        originalFileName: 'report.pdf',
      });
    });

    it('falls back to .pdf extension when original name is not a pdf', async () => {
      const file = {
        originalname: 'report.bin',
        buffer: Buffer.from('x'),
      } as Express.Multer.File;

      const result = await service.savePdf(file);

      expect(result.fileUrl).toBe('/uploads/documents/fixed-uuid.pdf');
      expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
        join(documentDir, 'fixed-uuid.pdf'),
        file.buffer,
      );
    });
  });

  describe('deleteIfLocal', () => {
    it('does nothing when url is null or undefined', async () => {
      await service.deleteIfLocal(null);
      await service.deleteIfLocal(undefined);
      await service.deleteIfLocal('');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('unlinks a local file referenced by the public prefix', async () => {
      await service.deleteIfLocal('/uploads/documents/abc.pdf');

      expect(fsPromisesMock.unlink).toHaveBeenCalledWith(
        join(documentDir, 'abc.pdf'),
      );
    });

    it('resolves and unlinks when given a full url containing the prefix', async () => {
      await service.deleteIfLocal('https://cdn.example.com/uploads/documents/abc.pdf');

      expect(fsPromisesMock.unlink).toHaveBeenCalledWith(
        join(documentDir, 'abc.pdf'),
      );
    });

    it('ignores external urls outside the public prefix', async () => {
      await service.deleteIfLocal('https://example.com/other/abc.pdf');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('ignores paths attempting traversal or nested segments', async () => {
      await service.deleteIfLocal('/uploads/documents/../etc/passwd');
      await service.deleteIfLocal('/uploads/documents/nested/abc.pdf');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('swallows ENOENT errors from unlink', async () => {
      const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
      fsPromisesMock.unlink.mockRejectedValueOnce(enoent);

      await expect(
        service.deleteIfLocal('/uploads/documents/abc.pdf'),
      ).resolves.toBeUndefined();
    });

    it('rethrows non-ENOENT errors from unlink', async () => {
      const eacces = Object.assign(new Error('denied'), { code: 'EACCES' });
      fsPromisesMock.unlink.mockRejectedValueOnce(eacces);

      await expect(
        service.deleteIfLocal('/uploads/documents/abc.pdf'),
      ).rejects.toBe(eacces);
    });
  });
});
