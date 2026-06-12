import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubjectThumbnailStorageService } from './subject-thumbnail-storage.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects-query.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from './entities/subject.entity';
import { SubjectsService } from './subjects.service';

const TEMP_SUBJECT_MASTERY_SCORE = 0;

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly thumbnailStorageService: SubjectThumbnailStorageService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('thumbnail'))
  async create(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateSubjectDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new FileTypeValidator({ fileType: /(image\/png|image\/jpeg|image\/gif)$/ }),
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
        ],
      }),
    )
    thumbnail?: Express.Multer.File,
  ): Promise<SubjectResponseDto> {
    const subject = await this.withThumbnailCreate(currentUser.sub, dto, thumbnail);
    return this.toResponseDto(subject);
  }

  @Get()
  findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListSubjectsQueryDto,
  ): Promise<SubjectResponseDto[]> {
    return this.subjectsService
      .findAll(currentUser.sub, query.name)
      .then((subjects) => subjects.map((subject) => this.toResponseDto(subject)));
  }

  @Get(':subjectId')
  findOne(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService
      .findOne(currentUser.sub, subjectId)
      .then((subject) => this.toResponseDto(subject));
  }

  @Patch(':subjectId')
  @UseInterceptors(FileInterceptor('thumbnail'))
  async update(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new FileTypeValidator({ fileType: /(image\/png|image\/jpeg|image\/gif)$/ }),
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
        ],
      }),
    )
    thumbnail?: Express.Multer.File,
  ): Promise<SubjectResponseDto> {
    const subject = await this.withThumbnailUpdate(
      currentUser.sub,
      subjectId,
      dto,
      thumbnail,
    );
    return this.toResponseDto(subject);
  }

  @Delete(':subjectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<void> {
    await this.subjectsService.remove(currentUser.sub, subjectId);
  }

  private async withThumbnailCreate(
    userId: string,
    dto: CreateSubjectDto,
    thumbnail?: Express.Multer.File,
  ): Promise<Subject> {
    let uploadedThumbnailUrl: string | undefined;

    if (thumbnail) {
      uploadedThumbnailUrl = await this.thumbnailStorageService.save(thumbnail);
    }

    try {
      return await this.subjectsService.create(userId, {
        ...dto,
        ...(uploadedThumbnailUrl ? { thumbnailUrl: uploadedThumbnailUrl } : {}),
      });
    } catch (error) {
      if (uploadedThumbnailUrl) {
        await this.thumbnailStorageService.deleteIfLocal(uploadedThumbnailUrl);
      }
      throw error;
    }
  }

  private async withThumbnailUpdate(
    userId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
    thumbnail?: Express.Multer.File,
  ): Promise<Subject> {
    let uploadedThumbnailUrl: string | undefined;

    if (thumbnail) {
      uploadedThumbnailUrl = await this.thumbnailStorageService.save(thumbnail);
    }

    try {
      return await this.subjectsService.update(userId, subjectId, {
        ...dto,
        ...(uploadedThumbnailUrl ? { thumbnailUrl: uploadedThumbnailUrl } : {}),
      });
    } catch (error) {
      if (uploadedThumbnailUrl) {
        await this.thumbnailStorageService.deleteIfLocal(uploadedThumbnailUrl);
      }
      throw error;
    }
  }

  private toResponseDto(subject: Subject): SubjectResponseDto {
    return {
      id: subject.id,
      userId: subject.userId,
      name: subject.name,
      description: subject.description ?? null,
      thumbnailUrl: subject.thumbnailUrl ?? null,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
      masteryScore: TEMP_SUBJECT_MASTERY_SCORE,
    };
  }
}
