import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import { UserStatus } from '../../user/enums/user-status.enum';
import { JwtPayload } from '../dto/jwt-payload.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    const issuer = configService.get<string>('JWT_ISSUER');
    const audience = configService.get<string>('JWT_AUDIENCE');
    if (!secret || !issuer || !audience) {
      throw new InternalServerErrorException(
        'JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be configured.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer,
      audience,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const tokenType = payload.type ?? payload.tokenType;
    if (tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
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

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token is no longer valid.');
    }

    return {
      ...payload,
      type: tokenType,
      email: user.email,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    };
  }
}
