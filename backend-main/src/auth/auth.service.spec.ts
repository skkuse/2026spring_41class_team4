import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { AuthVerificationPurpose } from './entities/auth-verification-purpose.enum';
import { OauthAccount } from './entities/oauth-account.entity';
import { OauthProvider } from './entities/oauth-provider.enum';
import { PasswordCredential } from './entities/password-credential.entity';
import { VerificationDeliveryChannel } from './entities/verification-delivery-channel.enum';
import { MailService } from './mail.service';
import { VerificationCodeService } from './verification-code.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const verifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}));

const mockedCompare = compare as jest.MockedFunction<typeof compare>;

describe('AuthService', () => {
  let service: AuthService;

  // Transaction manager: per-entity repositories returned by getRepository().
  const txUserRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const txPasswordRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const txVerificationRepo = { findOne: jest.fn(), save: jest.fn() };
  const transactionManager = {
    getRepository: jest.fn((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'PasswordCredential') return txPasswordRepo;
      if (name === 'AuthVerificationCode') return txVerificationRepo;
      return txUserRepo;
    }),
  };

  const oauthAccountRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const passwordCredentialRepository = { findOne: jest.fn() };
  const userService = {
    findByEmail: jest.fn(),
    findByEmailAndName: jest.fn(),
    findById: jest.fn(),
    createOAuthUser: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };
  const verificationCodeService = {
    createVerificationCode: jest.fn(),
    verifyCodeByEmailAndPurpose: jest.fn(),
  };
  const mailService = {
    sendSignupVerificationCode: jest.fn(),
    sendPasswordResetVerificationCode: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'google-client-id',
    JWT_SECRET: 'secret',
    JWT_ISSUER: 'issuer',
    JWT_AUDIENCE: 'audience',
    BCRYPT_SALT_ROUNDS: '12',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User One',
    profileImageUrl: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // transaction(cb) runs the callback with the mocked manager and returns its result.
    oauthAccountRepository.manager.transaction.mockImplementation(
      async (cb: (m: typeof transactionManager) => unknown) => cb(transactionManager),
    );
    // Mirror repo.create() -> entity passthrough so create() args appear in save().
    txUserRepo.create.mockImplementation((entity) => entity);
    txPasswordRepo.create.mockImplementation((entity) => entity);
    oauthAccountRepository.create.mockImplementation((entity) => entity);
    jwtService.signAsync.mockImplementation(async (payload: { type: string }) =>
      payload.type === 'access' ? 'access-token' : 'refresh-token',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(OauthAccount), useValue: oauthAccountRepository },
        {
          provide: getRepositoryToken(PasswordCredential),
          useValue: passwordCredentialRepository,
        },
        { provide: UserService, useValue: userService },
        { provide: VerificationCodeService, useValue: verificationCodeService },
        { provide: MailService, useValue: mailService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('issues an access/refresh token pair with the correct payload on success', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);
      passwordCredentialRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        passwordHash: 'hashed',
      });
      mockedCompare.mockResolvedValue(true as never);

      const result = await service.login('USER@example.com ', 'plain-password');

      // Email lookup is normalized (trim + lowercase).
      expect(userService.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockedCompare).toHaveBeenCalledWith('plain-password', 'hashed');

      const accessPayload = jwtService.signAsync.mock.calls[0][0];
      expect(accessPayload).toMatchObject({
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
        type: 'access',
      });
      const refreshPayload = jwtService.signAsync.mock.calls[1][0];
      expect(refreshPayload.type).toBe('refresh');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'User One',
          profileImageUrl: null,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      });
    });

    it('rejects an unknown user with UnauthorizedException', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.login('nobody@example.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when no password credential exists', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);
      passwordCredentialRepository.findOne.mockResolvedValue(null);

      await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password with UnauthorizedException', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);
      passwordCredentialRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        passwordHash: 'hashed',
      });
      mockedCompare.mockResolvedValue(false as never);

      await expect(service.login('user@example.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('forbids login for a non-active account', async () => {
      userService.findByEmail.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });
      passwordCredentialRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        passwordHash: 'hashed',
      });
      mockedCompare.mockResolvedValue(true as never);

      await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('requestRegisterVerificationCode', () => {
    it('creates and emails a signup verification code for a new email', async () => {
      userService.findByEmail.mockResolvedValue(null);
      verificationCodeService.createVerificationCode.mockResolvedValue('123456');

      const result = await service.requestRegisterVerificationCode('NEW@example.com');

      expect(verificationCodeService.createVerificationCode).toHaveBeenCalledWith({
        email: 'new@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        deliveryChannel: VerificationDeliveryChannel.EMAIL,
      });
      expect(mailService.sendSignupVerificationCode).toHaveBeenCalledWith(
        'new@example.com',
        '123456',
      );
      expect(result).toEqual({ success: true });
    });

    it('rejects when the email already exists', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);

      await expect(
        service.requestRegisterVerificationCode('user@example.com'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(verificationCodeService.createVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('registerWithVerificationCode', () => {
    it('creates user + password credential and consumes the code in a transaction', async () => {
      userService.findByEmail.mockResolvedValue(null);
      verificationCodeService.verifyCodeByEmailAndPurpose.mockResolvedValue({
        id: 'code-1',
      });
      txUserRepo.findOne.mockResolvedValue(null); // no duplicate inside tx
      txUserRepo.save.mockResolvedValue({ id: 'new-user' });
      txPasswordRepo.save.mockResolvedValue({});
      txVerificationRepo.findOne.mockResolvedValue({ id: 'code-1', consumedAt: null });
      txVerificationRepo.save.mockResolvedValue({});

      const result = await service.registerWithVerificationCode(
        '  New User  ',
        'NEW@example.com',
        'password',
        '123456',
      );

      expect(verificationCodeService.verifyCodeByEmailAndPurpose).toHaveBeenCalledWith({
        email: 'new@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        code: '123456',
      });
      // User saved with normalized email and trimmed name.
      const savedUser = txUserRepo.save.mock.calls[0][0];
      expect(savedUser).toMatchObject({
        email: 'new@example.com',
        name: 'New User',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
      });
      // Code row marked as consumed.
      expect(txVerificationRepo.save.mock.calls[0][0].consumedAt).toBeInstanceOf(Date);
      expect(result).toEqual({ success: true });
    });

    it('rejects when the email already exists before the transaction', async () => {
      userService.findByEmail.mockResolvedValue(activeUser);

      await expect(
        service.registerWithVerificationCode('Name', 'user@example.com', 'pw', '123456'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(oauthAccountRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects when a duplicate user is detected inside the transaction', async () => {
      userService.findByEmail.mockResolvedValue(null);
      verificationCodeService.verifyCodeByEmailAndPurpose.mockResolvedValue({
        id: 'code-1',
      });
      txUserRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.registerWithVerificationCode('Name', 'new@example.com', 'pw', '123456'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the verification code was already consumed inside the transaction', async () => {
      userService.findByEmail.mockResolvedValue(null);
      verificationCodeService.verifyCodeByEmailAndPurpose.mockResolvedValue({
        id: 'code-1',
      });
      txUserRepo.findOne.mockResolvedValue(null);
      txUserRepo.save.mockResolvedValue({ id: 'new-user' });
      txPasswordRepo.save.mockResolvedValue({});
      txVerificationRepo.findOne.mockResolvedValue({
        id: 'code-1',
        consumedAt: new Date(),
      });

      await expect(
        service.registerWithVerificationCode('Name', 'new@example.com', 'pw', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findId', () => {
    it('returns a masked email when the user is found', async () => {
      userService.findByEmailAndName.mockResolvedValue({ email: 'alice@example.com' });

      const result = await service.findId('alice@example.com', 'Alice');

      expect(result).toEqual({ found: true, email: 'a***@example.com' });
    });

    it('returns not found without leaking an email', async () => {
      userService.findByEmailAndName.mockResolvedValue(null);

      const result = await service.findId('ghost@example.com', 'Ghost');

      expect(result).toEqual({ found: false, email: null });
    });
  });

  describe('requestPasswordResetVerificationCode', () => {
    it('sends a reset code when the user exists', async () => {
      userService.findByEmailAndName.mockResolvedValue(activeUser);
      verificationCodeService.createVerificationCode.mockResolvedValue('654321');

      const result = await service.requestPasswordResetVerificationCode(
        'user@example.com',
        'User One',
      );

      expect(verificationCodeService.createVerificationCode).toHaveBeenCalledWith({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.PASSWORD_RESET,
        userId: 'user-1',
        deliveryChannel: VerificationDeliveryChannel.EMAIL,
      });
      expect(mailService.sendPasswordResetVerificationCode).toHaveBeenCalledWith(
        'user@example.com',
        '654321',
      );
      expect(result).toEqual({ success: true });
    });

    it('returns success without sending anything when the user does not exist (no enumeration)', async () => {
      userService.findByEmailAndName.mockResolvedValue(null);

      const result = await service.requestPasswordResetVerificationCode(
        'ghost@example.com',
        'Ghost',
      );

      expect(result).toEqual({ success: true });
      expect(verificationCodeService.createVerificationCode).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('confirmPasswordReset', () => {
    it('rejects when the user is not found', async () => {
      userService.findByEmailAndName.mockResolvedValue(null);

      await expect(
        service.confirmPasswordReset('ghost@example.com', 'Ghost', '111111', 'newpw'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verificationCodeService.verifyCodeByEmailAndPurpose).not.toHaveBeenCalled();
    });

    it('updates the password hash and bumps tokenVersion inside the transaction', async () => {
      userService.findByEmailAndName.mockResolvedValue(activeUser);
      verificationCodeService.verifyCodeByEmailAndPurpose.mockResolvedValue({
        id: 'code-1',
      });
      txPasswordRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        passwordHash: 'old',
      });
      txPasswordRepo.save.mockResolvedValue({});
      txUserRepo.findOne.mockResolvedValue({ id: 'user-1', tokenVersion: 3 });
      txUserRepo.save.mockResolvedValue({});
      txVerificationRepo.findOne.mockResolvedValue({ id: 'code-1', consumedAt: null });
      txVerificationRepo.save.mockResolvedValue({});

      const result = await service.confirmPasswordReset(
        'user@example.com',
        'User One',
        '111111',
        'newpw',
      );

      expect(verificationCodeService.verifyCodeByEmailAndPurpose).toHaveBeenCalledWith({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.PASSWORD_RESET,
        code: '111111',
      });
      expect(txUserRepo.save.mock.calls[0][0].tokenVersion).toBe(4);
      expect(txVerificationRepo.save.mock.calls[0][0].consumedAt).toBeInstanceOf(Date);
      expect(result).toEqual({ success: true });
    });

    it('rejects when no native credential exists inside the transaction', async () => {
      userService.findByEmailAndName.mockResolvedValue(activeUser);
      verificationCodeService.verifyCodeByEmailAndPurpose.mockResolvedValue({
        id: 'code-1',
      });
      txPasswordRepo.findOne.mockResolvedValue(null);

      await expect(
        service.confirmPasswordReset('user@example.com', 'User One', '111111', 'newpw'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('loginWithGoogle', () => {
    const googlePayload = {
      sub: 'google-sub-1',
      email: 'gmail@example.com',
      name: 'Google User',
      picture: 'http://img/pic.png',
      email_verified: true,
    };

    it('logs in via an existing linked oauth account', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
      oauthAccountRepository.findOne.mockResolvedValue({
        user: { ...activeUser, id: 'user-9' },
      });

      const result = await service.loginWithGoogle({ idToken: 'token' });

      expect(userService.createOAuthUser).not.toHaveBeenCalled();
      expect(oauthAccountRepository.save).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-9');
      expect(result.accessToken).toBe('access-token');
    });

    it('creates a new user and links the oauth account on first login', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
      oauthAccountRepository.findOne.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      userService.createOAuthUser.mockResolvedValue({ ...activeUser, id: 'user-new' });
      oauthAccountRepository.save.mockResolvedValue({});

      const result = await service.loginWithGoogle({ idToken: 'token' });

      expect(userService.createOAuthUser).toHaveBeenCalledWith({
        email: 'gmail@example.com',
        name: 'Google User',
        profileImageUrl: 'http://img/pic.png',
      });
      const linked = oauthAccountRepository.save.mock.calls[0][0];
      expect(linked).toMatchObject({
        userId: 'user-new',
        provider: OauthProvider.GOOGLE,
        providerUserId: 'google-sub-1',
      });
      expect(result.user.id).toBe('user-new');
    });

    it('links a new oauth account to an existing user matched by email', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
      oauthAccountRepository.findOne.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue({ ...activeUser, id: 'user-mail' });
      oauthAccountRepository.save.mockResolvedValue({});

      const result = await service.loginWithGoogle({ idToken: 'token' });

      expect(userService.createOAuthUser).not.toHaveBeenCalled();
      expect(oauthAccountRepository.save.mock.calls[0][0].userId).toBe('user-mail');
      expect(result.user.id).toBe('user-mail');
    });

    it('rejects an invalid google id token', async () => {
      verifyIdToken.mockRejectedValue(new Error('bad token'));

      await expect(
        service.loginWithGoogle({ idToken: 'token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the google email is not verified', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...googlePayload, email_verified: false }),
      });

      await expect(
        service.loginWithGoogle({ idToken: 'token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when a linked user is not active', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
      oauthAccountRepository.findOne.mockResolvedValue({
        user: { ...activeUser, status: UserStatus.DELETED },
      });

      await expect(
        service.loginWithGoogle({ idToken: 'token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    const refreshPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      type: 'refresh' as const,
    };

    it('issues a fresh token pair for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue(refreshPayload);
      userService.findById.mockResolvedValue(activeUser);

      const result = await service.refreshToken({ refreshToken: 'rt' });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');
    });

    it('rejects a token whose type is not refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({ ...refreshPayload, type: 'access' });

      await expect(
        service.refreshToken({ refreshToken: 'rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('rejects when verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.refreshToken({ refreshToken: 'rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue(refreshPayload);
      userService.findById.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the token version no longer matches (revoked)', async () => {
      jwtService.verifyAsync.mockResolvedValue(refreshPayload);
      userService.findById.mockResolvedValue({ ...activeUser, tokenVersion: 5 });

      await expect(
        service.refreshToken({ refreshToken: 'rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the account is not active', async () => {
      jwtService.verifyAsync.mockResolvedValue(refreshPayload);
      userService.findById.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.refreshToken({ refreshToken: 'rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logoutAllSessions', () => {
    it('increments the token version for an existing user', async () => {
      userService.findById.mockResolvedValue(activeUser);

      await service.logoutAllSessions('user-1');

      expect(userService.incrementTokenVersion).toHaveBeenCalledWith('user-1');
    });

    it('rejects when the user does not exist', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.logoutAllSessions('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userService.incrementTokenVersion).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the auth user dto for an active user', async () => {
      userService.findById.mockResolvedValue(activeUser);

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        profileImageUrl: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });
    });

    it('rejects when the user does not exist', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the user is not active', async () => {
      userService.findById.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.getCurrentUser('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
