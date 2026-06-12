import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/enums/user-role.enum';
import { UserStatus } from '../../user/enums/user-status.enum';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const userRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_ISSUER: 'test-issuer',
                JWT_AUDIENCE: 'test-audience',
              };
              return values[key];
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('extracts jwt from Authorization Bearer header', () => {
    const extractor = (
      strategy as unknown as { _jwtFromRequest: (req: unknown) => string | null }
    )._jwtFromRequest;

    const tokenFromBearer = extractor({
      headers: { authorization: 'Bearer access-token' },
    });
    const tokenFromCookieOnly = extractor({
      headers: { cookie: 'jwt=access-token' },
      cookies: { jwt: 'access-token' },
    });

    expect(tokenFromBearer).toBe('access-token');
    expect(tokenFromCookieOnly).toBeNull();
  });

  it('rejects refresh token on access-token guard path', async () => {
    const refreshPayload: JwtPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      type: 'refresh',
    };

    await expect(strategy.validate(refreshPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('validates access token and returns normalized payload with user status', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 2,
    });

    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'stale@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tokenVersion: 2,
      type: 'access',
    };

    const validated = await strategy.validate(payload);

    expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(validated.email).toBe('user@example.com');
    expect(validated.role).toBe(UserRole.ADMIN);
    expect(validated.status).toBe(UserStatus.ACTIVE);
  });
});
