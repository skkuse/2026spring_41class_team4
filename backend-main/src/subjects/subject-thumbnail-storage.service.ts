import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveUploadRoot } from '../common/upload-path.util';

const SUBJECT_THUMBNAIL_PUBLIC_PREFIX = '/uploads/subject-thumbnails';

@Injectable()
export class SubjectThumbnailStorageService {
  private readonly subjectThumbnailDir: string;

  constructor(private readonly configService: ConfigService) {
    const uploadRoot = resolveUploadRoot(this.configService.get<string>('UPLOAD_ROOT'));
    this.subjectThumbnailDir = join(uploadRoot, 'subject-thumbnails');
  }

  async save(file: Express.Multer.File): Promise<string> {
    await mkdir(this.subjectThumbnailDir, { recursive: true });

    const extension = this.resolveExtension(file);
    const fileName = `${randomUUID()}${extension}`;
    const filePath = join(this.subjectThumbnailDir, fileName);

    await writeFile(filePath, file.buffer);

    return `${SUBJECT_THUMBNAIL_PUBLIC_PREFIX}/${fileName}`;
  }

  async deleteIfLocal(thumbnailUrl?: string | null): Promise<void> {
    if (!thumbnailUrl) {
      return;
    }

    const localPath = this.extractLocalFilePath(thumbnailUrl);
    if (!localPath) {
      return;
    }

    try {
      await unlink(localPath);
    } catch (error) {
      const ioError = error as NodeJS.ErrnoException;
      if (ioError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromOriginalName = extname(file.originalname).toLowerCase();
    if (fromOriginalName === '.png' || fromOriginalName === '.jpg' || fromOriginalName === '.jpeg' || fromOriginalName === '.gif') {
      return fromOriginalName;
    }

    const mimeMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
    };

    return mimeMap[file.mimetype] ?? '.bin';
  }

  private extractLocalFilePath(thumbnailUrl: string): string | null {
    let pathname = thumbnailUrl;

    try {
      pathname = new URL(thumbnailUrl).pathname;
    } catch {
      pathname = thumbnailUrl;
    }

    const normalizedPath = pathname.replace(/\\/g, '/');
    const expectedPrefix = `${SUBJECT_THUMBNAIL_PUBLIC_PREFIX}/`;

    if (!normalizedPath.startsWith(expectedPrefix)) {
      return null;
    }

    const fileName = decodeURIComponent(normalizedPath.slice(expectedPrefix.length));

    if (!fileName || fileName.includes('/') || fileName.includes('..')) {
      return null;
    }

    return join(this.subjectThumbnailDir, fileName);
  }
}
