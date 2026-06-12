import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Patch,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasteryService } from '../mastery/mastery.service';
import { UploadDocumentToSubjectDto } from './dto/upload-document-to-subject.dto';
import { UpdateDocumentTitleDto } from './dto/update-document-title.dto';
import { DocumentService } from './document.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly masteryService: MasteryService,
  ) {}

  @Post('subjects/:subjectId/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadToSubject(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: UploadDocumentToSubjectDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: 'application/pdf' }),
          // Frontend upload UI promises "MAX 50MB"; enforce it at the trust boundary.
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.uploadToSubject(
      subjectId,
      file,
      req.user.sub,
      dto.title,
    );
  }

  @Get('subjects/:subjectId/documents')
  async listBySubject(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.listSubjectDocuments(subjectId, req.user.sub);
  }

  @Post('documents/:documentId/analyze')
  async analyze(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.analyzeDocument(documentId, req.user.sub);
  }

  @Get('documents/:documentId')
  async getDetail(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.getDocumentDetail(documentId, req.user.sub);
  }

  @Get('documents/:documentId/status')
  async getStatus(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.getDocumentStatus(documentId, req.user.sub);
  }

  @Get('documents/:documentId/learning-status')
  async getLearningStatus(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.masteryService.getDocumentLearningStatus(
      req.user.sub,
      documentId,
    );
  }

  @Patch('documents/:documentId/title')
  async updateTitle(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateDocumentTitleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.updateDocumentTitle(
      documentId,
      req.user.sub,
      dto.title,
    );
  }

  @Delete('documents/:documentId')
  async deleteDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documentService.deleteDocument(documentId, req.user.sub);
  }
}
