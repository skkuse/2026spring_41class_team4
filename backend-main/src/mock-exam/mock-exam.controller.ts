import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMockExamDto } from './dto/create-mock-exam.dto';
import { CreateMockExamResponseDto } from './dto/create-mock-exam-response.dto';
import { MockExamListItemDto } from './dto/mock-exam-list-response.dto';
import { MockExamService } from './mock-exam.service';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class MockExamController {
  constructor(private readonly mockExamService: MockExamService) {}

  @Post(':subjectId/mock-exams')
  createMockExam(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: CreateMockExamDto,
  ): Promise<CreateMockExamResponseDto> {
    return this.mockExamService.createMockExam(
      currentUser.sub,
      subjectId,
      dto,
    );
  }

  @Get(':subjectId/mock-exams')
  listMockExams(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<MockExamListItemDto[]> {
    return this.mockExamService.listMockExams(currentUser.sub, subjectId);
  }
}
