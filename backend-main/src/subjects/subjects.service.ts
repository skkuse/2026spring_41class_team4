import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { SubjectThumbnailStorageService } from './subject-thumbnail-storage.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from './entities/subject.entity';

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    private readonly thumbnailStorageService: SubjectThumbnailStorageService,
  ) {}

  async create(userId: string, dto: CreateSubjectDto): Promise<Subject> {
    try {
      const subject = this.subjectRepository.create({
        userId,
        name: dto.name,
        description: dto.description ?? null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
      });
      return await this.subjectRepository.save(subject);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Subject name already exists for this user.',
        );
      }
      throw error;
    }
  }

  async findAll(userId: string, name?: string): Promise<Subject[]> {
    const trimmedName = name?.trim();
    return this.subjectRepository.find({
      where: {
        userId,
        ...(trimmedName ? { name: ILike(`%${trimmedName}%`) } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, subjectId: string): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: {
        id: subjectId,
        userId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    return subject;
  }

  async update(
    userId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
  ): Promise<Subject> {
    const subject = await this.findOne(userId, subjectId);
    const previousThumbnailUrl = subject.thumbnailUrl ?? null;

    if (dto.name !== undefined) {
      subject.name = dto.name;
    }
    if (dto.description !== undefined) {
      subject.description = dto.description ?? null;
    }
    if (dto.thumbnailUrl !== undefined) {
      subject.thumbnailUrl = dto.thumbnailUrl ?? null;
    }

    try {
      const savedSubject = await this.subjectRepository.save(subject);

      if (
        previousThumbnailUrl &&
        previousThumbnailUrl !== (savedSubject.thumbnailUrl ?? null)
      ) {
        await this.cleanupThumbnailSafely(previousThumbnailUrl, {
          action: 'update',
          subjectId: savedSubject.id,
          userId,
        });
      }

      return savedSubject;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Subject name already exists for this user.',
        );
      }
      throw error;
    }
  }

  // TODO(hard-delete): When subject-owned modules are implemented, ensure
  // FK onDelete: 'CASCADE' is applied for subject_id relations and run
  // storage cleanup (e.g., document files) in the same delete flow.
  async remove(userId: string, subjectId: string): Promise<void> {
    const subject = await this.findOne(userId, subjectId);
    const result = await this.subjectRepository.delete({ id: subjectId, userId });
    if (!result.affected) {
      throw new NotFoundException('Subject not found.');
    }
    await this.cleanupThumbnailSafely(subject.thumbnailUrl ?? null, {
      action: 'delete',
      subjectId,
      userId,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '23505';
  }

  private async cleanupThumbnailSafely(
    thumbnailUrl: string | null | undefined,
    context: { action: 'update' | 'delete'; subjectId: string; userId: string },
  ): Promise<void> {
    if (!thumbnailUrl) {
      return;
    }

    try {
      await this.thumbnailStorageService.deleteIfLocal(thumbnailUrl);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'subjects.thumbnail_cleanup_failed',
          action: context.action,
          subjectId: context.subjectId,
          userId: context.userId,
          thumbnailUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
