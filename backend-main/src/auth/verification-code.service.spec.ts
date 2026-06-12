import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { AuthVerificationCode } from './entities/auth-verification-code.entity';
import { AuthVerificationPurpose } from './entities/auth-verification-purpose.enum';
import { VerificationDeliveryChannel } from './entities/verification-delivery-channel.enum';
import { VerificationCodeService } from './verification-code.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockedCompare = compare as jest.MockedFunction<typeof compare>;
const mockedHash = hash as jest.MockedFunction<typeof hash>;

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;

  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const configValues: Record<string, string> = {};
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(configValues)) {
      delete configValues[key];
    }
    // Mirror repo.create() -> entity passthrough so create() args appear in save().
    repository.create.mockImplementation((entity) => entity);
    mockedHash.mockResolvedValue('hashed-code' as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        {
          provide: getRepositoryToken(AuthVerificationCode),
          useValue: repository,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNumericVerificationCode', () => {
    it('generates a 6-digit numeric code by default', () => {
      const code = service.generateNumericVerificationCode();

      expect(code).toMatch(/^[0-9]{6}$/);
    });

    it('respects a configured code length within bounds', () => {
      configValues.AUTH_VERIFICATION_CODE_LENGTH = '8';

      const code = service.generateNumericVerificationCode();

      expect(code).toMatch(/^[0-9]{8}$/);
    });

    it('falls back to length 6 when the configured length is out of bounds', () => {
      configValues.AUTH_VERIFICATION_CODE_LENGTH = '99';

      const code = service.generateNumericVerificationCode();

      expect(code).toMatch(/^[0-9]{6}$/);
    });
  });

  describe('createVerificationCode', () => {
    it('hashes the code and saves a normalized entity, returning the plaintext code', async () => {
      repository.save.mockResolvedValue({});

      const code = await service.createVerificationCode({
        email: '  USER@Example.com ',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
      });

      expect(code).toMatch(/^[0-9]{6}$/);
      // Plaintext code is hashed before storage.
      expect(mockedHash).toHaveBeenCalledWith(code, 12);

      const saved = repository.save.mock.calls[0][0];
      expect(saved).toMatchObject({
        userId: null,
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        codeHash: 'hashed-code',
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
        deliveryChannel: VerificationDeliveryChannel.EMAIL,
      });
      // The hash is stored, never the plaintext code.
      expect(saved.codeHash).not.toBe(code);
      expect(saved.expiresAt).toBeInstanceOf(Date);
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('uses the provided userId and delivery channel', async () => {
      repository.save.mockResolvedValue({});

      await service.createVerificationCode({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.PASSWORD_RESET,
        userId: 'user-1',
        deliveryChannel: VerificationDeliveryChannel.SMS,
      });

      const saved = repository.save.mock.calls[0][0];
      expect(saved).toMatchObject({
        userId: 'user-1',
        purpose: AuthVerificationPurpose.PASSWORD_RESET,
        deliveryChannel: VerificationDeliveryChannel.SMS,
      });
    });

    it('uses a configured TTL for the expiry date', async () => {
      configValues.AUTH_VERIFICATION_CODE_TTL_MINUTES = '30';
      repository.save.mockResolvedValue({});

      const before = Date.now();
      await service.createVerificationCode({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
      });

      const saved = repository.save.mock.calls[0][0];
      const expiresIn = saved.expiresAt.getTime() - before;
      // ~30 minutes from now (allow a small execution window).
      expect(expiresIn).toBeGreaterThanOrEqual(29 * 60_000);
      expect(expiresIn).toBeLessThanOrEqual(31 * 60_000);
    });

    it('uses a configured bcrypt salt round count', async () => {
      configValues.BCRYPT_SALT_ROUNDS = '8';
      repository.save.mockResolvedValue({});

      const code = await service.createVerificationCode({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
      });

      expect(mockedHash).toHaveBeenCalledWith(code, 8);
    });
  });

  describe('verifyCodeByEmailAndPurpose', () => {
    const baseCandidate = (): AuthVerificationCode =>
      ({
        id: 'code-1',
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
      }) as unknown as AuthVerificationCode;

    it('returns the candidate and stamps verifiedAt on a correct code', async () => {
      const candidate = baseCandidate();
      repository.findOne.mockResolvedValue(candidate);
      repository.save.mockResolvedValue(candidate);
      mockedCompare.mockResolvedValue(true as never);

      const result = await service.verifyCodeByEmailAndPurpose({
        email: '  USER@Example.com ',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        code: '123456',
      });

      // Lookup uses normalized email and the latest code.
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        },
        order: { createdAt: 'DESC' },
      });
      expect(mockedCompare).toHaveBeenCalledWith('123456', 'hashed-code');
      expect(result).toBe(candidate);
      expect(candidate.verifiedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalledWith(candidate);
    });

    it('does not re-stamp verifiedAt when the code was already verified', async () => {
      const verifiedAt = new Date(Date.now() - 1_000);
      const candidate = { ...baseCandidate(), verifiedAt };
      repository.findOne.mockResolvedValue(candidate);
      mockedCompare.mockResolvedValue(true as never);

      const result = await service.verifyCodeByEmailAndPurpose({
        email: 'user@example.com',
        purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
        code: '123456',
      });

      expect(result.verifiedAt).toBe(verifiedAt);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects when no candidate exists', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: '123456',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the code was already consumed', async () => {
      repository.findOne.mockResolvedValue({
        ...baseCandidate(),
        consumedAt: new Date(),
      });

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: '123456',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockedCompare).not.toHaveBeenCalled();
    });

    it('rejects with 429 when the attempt count is already at the limit', async () => {
      repository.findOne.mockResolvedValue({
        ...baseCandidate(),
        attemptCount: 5,
      });

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: '123456',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(mockedCompare).not.toHaveBeenCalled();
    });

    it('rejects an expired code before comparing', async () => {
      repository.findOne.mockResolvedValue({
        ...baseCandidate(),
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: '123456',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockedCompare).not.toHaveBeenCalled();
    });

    it('increments the attempt count and rejects on a wrong code', async () => {
      const candidate = baseCandidate();
      repository.findOne.mockResolvedValue(candidate);
      repository.save.mockResolvedValue(candidate);
      mockedCompare.mockResolvedValue(false as never);

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: 'wrong',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(candidate.attemptCount).toBe(1);
      expect(repository.save).toHaveBeenCalledWith(candidate);
    });

    it('rejects with 429 when a wrong code pushes the attempt count to the limit', async () => {
      const candidate = { ...baseCandidate(), attemptCount: 4 };
      repository.findOne.mockResolvedValue(candidate);
      repository.save.mockResolvedValue(candidate);
      mockedCompare.mockResolvedValue(false as never);

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: 'wrong',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(candidate.attemptCount).toBe(5);
    });

    it('honors a configured max attempts value', async () => {
      configValues.AUTH_VERIFICATION_MAX_ATTEMPTS = '2';
      repository.findOne.mockResolvedValue({
        ...baseCandidate(),
        attemptCount: 2,
      });

      await expect(
        service.verifyCodeByEmailAndPurpose({
          email: 'user@example.com',
          purpose: AuthVerificationPurpose.SIGNUP_VERIFICATION,
          code: '123456',
        }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('consumeCode', () => {
    it('stamps consumedAt and saves the candidate', async () => {
      const candidate = { id: 'code-1', consumedAt: null };
      repository.findOne.mockResolvedValue(candidate);
      repository.save.mockResolvedValue(candidate);

      await service.consumeCode('code-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'code-1' },
      });
      expect(candidate.consumedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalledWith(candidate);
    });

    it('rejects when the code is not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.consumeCode('missing')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects when the code was already consumed', async () => {
      repository.findOne.mockResolvedValue({
        id: 'code-1',
        consumedAt: new Date(),
      });

      await expect(service.consumeCode('code-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
