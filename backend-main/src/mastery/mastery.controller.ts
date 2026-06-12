import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SubjectDashboardResponseDto,
  SubjectLearningStatusResponseDto,
  SubjectMasteryResponseDto,
} from './dto/subject-mastery-response.dto';
import { MasteryService } from './mastery.service';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class MasteryController {
  constructor(private readonly masteryService: MasteryService) {}

  @Get(':subjectId/mastery')
  getSubjectMastery(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<SubjectMasteryResponseDto> {
    return this.masteryService.getSubjectMastery(currentUser.sub, subjectId);
  }

  @Get(':subjectId/learning-status')
  getSubjectLearningStatus(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<SubjectLearningStatusResponseDto> {
    return this.masteryService.getSubjectLearningStatus(
      currentUser.sub,
      subjectId,
    );
  }

  @Get(':subjectId/dashboard')
  getSubjectDashboard(
    @CurrentUser() currentUser: JwtPayload,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ): Promise<SubjectDashboardResponseDto> {
    return this.masteryService.getSubjectDashboard(currentUser.sub, subjectId);
  }
}
