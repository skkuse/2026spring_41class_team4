import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthResultDto, AuthUserDto, SuccessResponse } from './dto/auth-result.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { FindIdDto } from './dto/find-id.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtPayload } from './dto/jwt-payload.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetVerificationCodeDto } from './dto/request-password-reset-verification-code.dto';
import { RequestRegisterVerificationCodeDto } from './dto/request-register-verification-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/verification-code')
  requestRegisterVerificationCode(
    @Body() dto: RequestRegisterVerificationCodeDto,
  ): Promise<{ success: true }> {
    return this.authService.requestRegisterVerificationCode(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<SuccessResponse> {
    return this.authService.registerWithVerificationCode(
      dto.name,
      dto.email,
      dto.password,
      dto.verificationCode,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResultDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('find-id')
  findId(
    @Body() dto: FindIdDto,
  ): Promise<{ found: boolean; email: string | null }> {
    return this.authService.findId(dto.email, dto.name);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/verification-code')
  requestPasswordResetVerificationCode(
    @Body() dto: RequestPasswordResetVerificationCodeDto,
  ): Promise<{ success: true }> {
    return this.authService.requestPasswordResetVerificationCode(
      dto.email,
      dto.name,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<{ success: true }> {
    return this.authService.confirmPasswordReset(
      dto.email,
      dto.name,
      dto.verificationCode,
      dto.newPassword,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('google')
  loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
  ): Promise<AuthResultDto> {
    return this.authService.loginWithGoogle(dto, { ip: req.ip });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResultDto> {
    return this.authService.refreshToken(dto, { ip: req.ip });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest): Promise<{ success: true }> {
    await this.authService.logoutAllSessions(req.user.sub, { ip: req.ip });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest): Promise<AuthUserDto> {
    return this.authService.getCurrentUser(req.user.sub);
  }
}
