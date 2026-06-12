import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { SubjectThumbnailStorageService } from './subject-thumbnail-storage.service';

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

describe('SubjectThumbnailStorageService', () => {
  let service: SubjectThumbnailStorageService;
  const uploadRoot = '/tmp/test-uploads';
  const thumbnailDir = join(uploadRoot, 'subject-thumbnails');

  const configService = {
    get: jest.fn((key: string) => (key === 'UPLOAD_ROOT' ? uploadRoot : undefined)),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    fsPromisesMock.mkdir.mockResolvedValue(undefined);
    fsPromisesMock.writeFile.mockResolvedValue(undefined);
    fsPromisesMock.unlink.mockResolvedValue(undefined);
    service = new SubjectThumbnailStorageService(configService);
  });

  describe('save', () => {
    it('creates the directory, writes the file and returns the public url', async () => {
      const file = {
        originalname: 'thumb.png',
        mimetype: 'image/png',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;

      const result = await service.save(file);

      expect(fsPromisesMock.mkdir).toHaveBeenCalledWith(thumbnailDir, {
        recursive: true,
      });
      expect(fsPromisesMock.writeFile).toHaveBeenCalledWith(
        join(thumbnailDir, 'fixed-uuid.png'),
        file.buffer,
      );
      expect(result).toBe('/uploads/subject-thumbnails/fixed-uuid.png');
    });

    it('keeps a recognised extension from the original name', async () => {
      const file = {
        originalname: 'pic.JPEG',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;

      const result = await service.save(file);

      expect(result).toBe('/uploads/subject-thumbnails/fixed-uuid.jpeg');
    });

    it('derives extension from mimetype when original extension is unknown', async () => {
      const file = {
        originalname: 'pic',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;

      const result = await service.save(file);

      expect(result).toBe('/uploads/subject-thumbnails/fixed-uuid.jpg');
    });

    it('falls back to .bin when neither name nor mimetype is recognised', async () => {
      const file = {
        originalname: 'pic',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;

      const result = await service.save(file);

      expect(result).toBe('/uploads/subject-thumbnails/fixed-uuid.bin');
    });
  });

  describe('deleteIfLocal', () => {
    it('does nothing when url is empty', async () => {
      await service.deleteIfLocal(null);
      await service.deleteIfLocal(undefined);
      await service.deleteIfLocal('');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('unlinks a local thumbnail referenced by the public prefix', async () => {
      await service.deleteIfLocal('/uploads/subject-thumbnails/abc.png');

      expect(fsPromisesMock.unlink).toHaveBeenCalledWith(
        join(thumbnailDir, 'abc.png'),
      );
    });

    it('resolves and unlinks a full url containing the prefix', async () => {
      await service.deleteIfLocal(
        'https://cdn.example.com/uploads/subject-thumbnails/abc.png',
      );

      expect(fsPromisesMock.unlink).toHaveBeenCalledWith(
        join(thumbnailDir, 'abc.png'),
      );
    });

    it('ignores external urls outside the public prefix', async () => {
      await service.deleteIfLocal('https://example.com/images/abc.png');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('ignores traversal or nested paths', async () => {
      await service.deleteIfLocal('/uploads/subject-thumbnails/../secret.png');
      await service.deleteIfLocal('/uploads/subject-thumbnails/nested/abc.png');

      expect(fsPromisesMock.unlink).not.toHaveBeenCalled();
    });

    it('swallows ENOENT errors from unlink', async () => {
      const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
      fsPromisesMock.unlink.mockRejectedValueOnce(enoent);

      await expect(
        service.deleteIfLocal('/uploads/subject-thumbnails/abc.png'),
      ).resolves.toBeUndefined();
    });

    it('rethrows non-ENOENT errors from unlink', async () => {
      const eacces = Object.assign(new Error('denied'), { code: 'EACCES' });
      fsPromisesMock.unlink.mockRejectedValueOnce(eacces);

      await expect(
        service.deleteIfLocal('/uploads/subject-thumbnails/abc.png'),
      ).rejects.toBe(eacces);
    });
  });
});
