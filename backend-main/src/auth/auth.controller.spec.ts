import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    loginWithGoogle: jest.fn(),
    refreshToken: jest.fn(),
    logoutAllSessions: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('accepts google idToken from request body and returns json auth result', async () => {
    authService.loginWithGoogle.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User Name',
        profileImageUrl: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const req = { ip: '127.0.0.1' };
    const result = await controller.loginWithGoogle(
      { idToken: 'google-id-token' },
      req as never,
    );

    expect(authService.loginWithGoogle).toHaveBeenCalledWith(
      { idToken: 'google-id-token' },
      { ip: '127.0.0.1' },
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('accepts refreshToken from request body', async () => {
    authService.refreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User Name',
        profileImageUrl: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const req = { ip: '127.0.0.1' };
    const result = await controller.refreshToken(
      { refreshToken: 'refresh-token' },
      req as never,
    );

    expect(authService.refreshToken).toHaveBeenCalledWith(
      { refreshToken: 'refresh-token' },
      { ip: '127.0.0.1' },
    );
    expect(result.accessToken).toBe('new-access-token');
  });

  it('invalidates sessions on logout and returns success response', async () => {
    authService.logoutAllSessions.mockResolvedValue(undefined);

    const req = { user: { sub: 'user-1' }, ip: '127.0.0.1' };
    const result = await controller.logout(req as never);

    expect(authService.logoutAllSessions).toHaveBeenCalledWith('user-1', {
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ success: true });
  });
});
