import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserMeDto } from './dto/user-me.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest): Promise<UserMeDto> {
    return this.userService.getMe(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMeDto,
  ): Promise<UserMeDto> {
    return this.userService.updateMyName(req.user.sub, dto.name);
  }
}
