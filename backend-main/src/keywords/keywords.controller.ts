import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KeywordResponseDto } from './dto/keyword-response.dto';
import { KeywordsService } from './keywords.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller()
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Get('subjects/:subjectId/keywords')
  async getSubjectKeywords(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<KeywordResponseDto[]> {
    return this.keywordsService.getSubjectKeywords(subjectId, req.user.sub);
  }

  @Get('documents/:documentId/keywords')
  async getDocumentKeywords(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<KeywordResponseDto[]> {
    return this.keywordsService.getDocumentKeywords(documentId, req.user.sub);
  }
}