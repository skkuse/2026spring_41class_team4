import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { resolveUploadRoot } from '../common/upload-path.util';

const DOCUMENT_PUBLIC_PREFIX = '/uploads/documents';

@Injectable()
export class DocumentFileStorageService {
  private readonly documentUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const uploadRoot = resolveUploadRoot(this.configService.get<string>('UPLOAD_ROOT'));
    this.documentUploadDir = join(uploadRoot, 'documents');
  }

  async savePdf(file: Express.Multer.File): Promise<{
    fileUrl: string;
    originalFileName: string;
  }> {
    await mkdir(this.documentUploadDir, { recursive: true });
    const extension = this.resolveExtension(file);
    const fileName = `${randomUUID()}${extension}`;
    const filePath = join(this.documentUploadDir, fileName);
    await writeFile(filePath, file.buffer);

    return {
      fileUrl: `${DOCUMENT_PUBLIC_PREFIX}/${fileName}`,
      originalFileName: file.originalname,
    };
  }

  async deleteIfLocal(fileUrl?: string | null): Promise<void> {
    if (!fileUrl) {
      return;
    }

    const localPath = this.extractLocalFilePath(fileUrl);
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
    const fromOriginal = extname(file.originalname).toLowerCase();
    if (fromOriginal === '.pdf') {
      return fromOriginal;
    }
    return '.pdf';
  }

  private extractLocalFilePath(fileUrl: string): string | null {
    let pathname = fileUrl;

    try {
      pathname = new URL(fileUrl).pathname;
    } catch {
      pathname = fileUrl;
    }

    const normalizedPath = pathname.replace(/\\/g, '/');
    const expectedPrefix = `${DOCUMENT_PUBLIC_PREFIX}/`;

    if (!normalizedPath.startsWith(expectedPrefix)) {
      return null;
    }

    const fileName = decodeURIComponent(normalizedPath.slice(expectedPrefix.length));
    if (!fileName || fileName.includes('/') || fileName.includes('..')) {
      return null;
    }

    return join(this.documentUploadDir, fileName);
  }
}

