import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { UserService } from '../user/user.service';
import { AuthResultDto, AuthUserDto, SuccessResponse } from './dto/auth-result.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtPayload } from './dto/jwt-payload.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthVerificationCode } from './entities/auth-verification-code.entity';
import { AuthVerificationPurpose } from './entities/auth-verification-purpose.enum';
import { OauthAccount } from './entities/oauth-account.entity';
import { OauthProvider } from './entities/oauth-provider.enum';
import { PasswordCredential } from './entities/password-credential.entity';
import { VerificationDeliveryChannel } from './entities/verification-delivery-channel.enum';
import { MailService } from './mail.service';
import { VerificationCodeService } from './verification-code.service';

interface VerifiedGoogleProfile {
  providerUserId: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
}

interface AuthAuditContext {
  ip?: string;
}

interface FindIdResult {
  found: boolean;
  email: string | null;
}

@Injectable()
export class AuthService {
  private readonly oauthClient: OAuth2Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OauthAccount)
    private readonly oauthAccountRepository: Repository<OauthAccount>,
    @InjectRepository(PasswordCredential)
    private readonly passwordCredentialRepository: Repository<PasswordCredential>,
    private readonly userService: UserService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured.');
    }
    this.oauthClient = new OAuth2Client(googleClientId);
  }

  async requestRegisterVerificationCode(email: string): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists.');
    }

    const code = await this.verificationCodeService.createVerificationCode({
      email: normalizedEmail,
      purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
      deliveryChannel: VerificationDeliveryChannel.EMAIL,
    });
    await this.mailService.sendSignupVerificationCode(normalizedEmail, code);
    return { success: true };
  }

  async registerWithVerificationCode(
    name: string,
    email: string,
    password: string,
    verificationCode: string,
  ): Promise<SuccessResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedName = name.trim();

    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists.');
    }

    const verifiedCode = await this.verificationCodeService.verifyCodeByEmailAndPurpose({
      email: normalizedEmail,
      purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
      code: verificationCode,
    });

    const passwordHash = await this.hashPassword(password);
    await this.oauthAccountRepository.manager.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const passwordRepo = manager.getRepository(PasswordCredential);
        const verificationRepo = manager.getRepository(AuthVerificationCode);

        const duplicate = await userRepository.findOne({
          where: { email: normalizedEmail },
        });
        if (duplicate) {
          throw new ConflictException('Email already exists.');
        }

        const createdUser = await userRepository.save(
          userRepository.create({
            email: normalizedEmail,
            name: trimmedName,
            profileImageUrl: null,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
            tokenVersion: 0,
            emailVerifiedAt: new Date(),
          }),
        );

        await passwordRepo.save(
          passwordRepo.create({
            userId: createdUser.id,
            passwordHash,
          }),
        );

        const codeRow = await verificationRepo.findOne({
          where: { id: verifiedCode.id },
        });
        if (!codeRow || codeRow.consumedAt) {
          throw new BadRequestException('Verification code has already been used.');
        }
        codeRow.consumedAt = new Date();
        await verificationRepo.save(codeRow);

        return createdUser;
      });

    return { success: true };
  }

  async login(email: string, password: string): Promise<AuthResultDto> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const credential = await this.passwordCredentialRepository.findOne({
      where: { userId: user.id },
    });
    if (!credential) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatched = await compare(password, credential.passwordHash);
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active.');
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user);
    return {
      accessToken,
      refreshToken,
      user: this.toAuthUserDto(user),
    };
  }

  async findId(email: string, name: string): Promise<FindIdResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedName = name.trim();
    const user = await this.userService.findByEmailAndName(
      normalizedEmail,
      trimmedName,
    );
    if (!user) {
      return { found: false, email: null };
    }

    return {
      found: true,
      email: this.maskEmail(user.email),
    };
  }

  async requestPasswordResetVerificationCode(
    email: string,
    name: string,
  ): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedName = name.trim();
    const user = await this.userService.findByEmailAndName(
      normalizedEmail,
      trimmedName,
    );

    if (user) {
      const code = await this.verificationCodeService.createVerificationCode({
        email: normalizedEmail,
        purpose: AuthVerificationPurpose.PASSWORD_RESET,
        userId: user.id,
        deliveryChannel: VerificationDeliveryChannel.EMAIL,
      });
      await this.mailService.sendPasswordResetVerificationCode(normalizedEmail, code);
    }

    return { success: true };
  }

  async confirmPasswordReset(
    email: string,
    name: string,
    verificationCode: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const trimmedName = name.trim();
    const user = await this.userService.findByEmailAndName(
      normalizedEmail,
      trimmedName,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid reset request.');
    }

    const verifiedCode = await this.verificationCodeService.verifyCodeByEmailAndPurpose({
      email: normalizedEmail,
      purpose: AuthVerificationPurpose.PASSWORD_RESET,
      code: verificationCode,
    });
    const newPasswordHash = await this.hashPassword(newPassword);

    await this.oauthAccountRepository.manager.transaction(async (manager) => {
      const passwordRepo = manager.getRepository(PasswordCredential);
      const userRepo = manager.getRepository(User);
      const verificationRepo = manager.getRepository(AuthVerificationCode);

      const credential = await passwordRepo.findOne({
        where: { userId: user.id },
      });
      if (!credential) {
        throw new UnauthorizedException('Native credential not found.');
      }
      credential.passwordHash = newPasswordHash;
      await passwordRepo.save(credential);

      const userRow = await userRepo.findOne({ where: { id: user.id } });
      if (!userRow) {
        throw new UnauthorizedException('User not found.');
      }
      userRow.tokenVersion += 1;
      await userRepo.save(userRow);

      const codeRow = await verificationRepo.findOne({
        where: { id: verifiedCode.id },
      });
      if (!codeRow || codeRow.consumedAt) {
        throw new BadRequestException('Verification code has already been used.');
      }
      codeRow.consumedAt = new Date();
      await verificationRepo.save(codeRow);
    });

    return { success: true };
  }

  async loginWithGoogle(
    dto: GoogleLoginDto,
    auditContext: AuthAuditContext = {},
  ): Promise<AuthResultDto> {
    let profile: VerifiedGoogleProfile;
    try {
      profile = await this.verifyGoogleIdToken(dto.idToken);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.failed',
          reason: error instanceof Error ? error.message : 'google_verification_failed',
          ip: auditContext.ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw error;
    }

    const existingOauthAccount = await this.oauthAccountRepository.findOne({
      where: {
        provider: OauthProvider.GOOGLE,
        providerUserId: profile.providerUserId,
      },
      relations: { user: true },
    });

    let user: User;

    if (existingOauthAccount?.user) {
      user = existingOauthAccount.user;
    } else {
      const existingUserByEmail = await this.userService.findByEmail(profile.email);
      const targetUser =
        existingUserByEmail ??
        (await this.userService.createOAuthUser({
          email: profile.email,
          name: profile.name,
          profileImageUrl: profile.profileImageUrl,
        }));

      await this.oauthAccountRepository.save(
        this.oauthAccountRepository.create({
          userId: targetUser.id,
          provider: OauthProvider.GOOGLE,
          providerUserId: profile.providerUserId,
          providerEmail: profile.email,
        }),
      );

      user = targetUser;
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.blocked_status',
          userId: user.id,
          status: user.status,
          ip: auditContext.ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Account is not active.');
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user);
    this.logger.log(
      JSON.stringify({
        event: 'auth.login.success',
        userId: user.id,
        ip: auditContext.ip ?? 'unknown',
        result: 'success',
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUserDto(user),
    };
  }

  async refreshToken(
    dto: RefreshTokenDto,
    auditContext: AuthAuditContext = {},
  ): Promise<AuthResultDto> {
    const payload = await this.verifyRefreshToken(dto.refreshToken, auditContext.ip);

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.failed',
          userId: payload.sub,
          reason: 'user_not_found',
          ip: auditContext.ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('User not found.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.inactive_account_access',
          userId: user.id,
          status: user.status,
          ip: auditContext.ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Account is not active.');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.failed',
          userId: user.id,
          reason: 'token_version_mismatch',
          ip: auditContext.ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user);
    this.logger.log(
      JSON.stringify({
        event: 'auth.refresh.success',
        userId: user.id,
        ip: auditContext.ip ?? 'unknown',
        result: 'success',
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUserDto(user),
    };
  }

  async logoutAllSessions(
    userId: string,
    auditContext: AuthAuditContext = {},
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    await this.userService.incrementTokenVersion(userId);

    this.logger.log(
      JSON.stringify({
        event: 'auth.logout.success',
        userId,
        ip: auditContext.ip ?? 'unknown',
        result: 'success',
      }),
    );
  }

  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.inactive_account_access',
          userId: user.id,
          status: user.status,
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Account is not active.');
    }

    return this.toAuthUserDto(user);
  }

  private async verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const ticket = await this.oauthClient
      .verifyIdToken({
        idToken,
        audience,
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid Google ID token.');
      });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.name) {
      throw new UnauthorizedException('Invalid Google token payload.');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified.');
    }

    const allowedDomain = this.configService.get<string>('AUTH_ALLOWED_EMAIL_DOMAIN');
    if (allowedDomain) {
      const normalizedDomain = allowedDomain.toLowerCase();
      if (!payload.email.toLowerCase().endsWith(`@${normalizedDomain}`)) {
        throw new UnauthorizedException('Email domain is not allowed.');
      }
    }

    return {
      providerUserId: payload.sub,
      email: payload.email,
      name: payload.name,
      profileImageUrl: payload.picture ?? null,
    };
  }

  private async issueTokenPair(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const secret = this.configService.get<string>('JWT_SECRET');
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    if (!secret || !issuer || !audience) {
      throw new InternalServerErrorException(
        'JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be configured.',
      );
    }

    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
      type: 'access',
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret,
      expiresIn: accessExpiresIn as never,
      issuer,
      audience,
      jwtid: accessJti,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret,
      expiresIn: refreshExpiresIn as never,
      issuer,
      audience,
      jwtid: refreshJti,
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    refreshToken: string,
    ip?: string,
  ): Promise<JwtPayload> {
    const secret = this.configService.get<string>('JWT_SECRET');
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');
    if (!secret || !issuer || !audience) {
      throw new InternalServerErrorException(
        'JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be configured.',
      );
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret,
        issuer,
        audience,
      });
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.failed',
          reason: 'invalid_token',
          ip: ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokenType = payload.type ?? payload.tokenType;
    if (tokenType !== 'refresh') {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.failed',
          userId: payload.sub,
          reason: 'invalid_token_type',
          ip: ip ?? 'unknown',
          result: 'denied',
        }),
      );
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return payload;
  }

  private toAuthUserDto(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl ?? null,
      role: user.role,
      status: user.status,
    };
  }

  private async hashPassword(rawPassword: string): Promise<string> {
    const rounds = this.getBcryptSaltRounds();
    return hash(rawPassword, rounds);
  }

  private getBcryptSaltRounds(): number {
    const raw = this.configService.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 4 || parsed > 31) {
      return 12;
    }
    return parsed;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return '***';
    }
    const prefix = local[0] ?? '*';
    return `${prefix}***@${domain}`;
  }
}
