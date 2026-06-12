import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

const sendMail = jest.fn();
const createTransport = jest.fn(() => ({ sendMail }));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => createTransport(...args),
  },
}));

const mockedCreateTransport = createTransport as jest.Mock;

describe('MailService', () => {
  let service: MailService;

  const fullSmtpConfig: Record<string, string> = {
    MAIL_HOST: 'smtp.example.com',
    MAIL_PORT: '587',
    MAIL_USER: 'mailer',
    MAIL_PASSWORD: 'secret',
    MAIL_FROM: 'no-reply@example.com',
  };

  let configValues: Record<string, string>;
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const build = async (values: Record<string, string>): Promise<void> => {
    configValues = values;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get<MailService>(MailService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createTransport.mockReturnValue({ sendMail });
    sendMail.mockResolvedValue(undefined);
  });

  it('should be defined', async () => {
    await build({ ...fullSmtpConfig });
    expect(service).toBeDefined();
  });

  describe('transporter configuration', () => {
    it('creates the transport from env with secure=false for non-465 ports', async () => {
      await build({ ...fullSmtpConfig, MAIL_PORT: '587' });

      await service.sendSignupVerificationCode('user@example.com', '123456');

      expect(mockedCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'mailer', pass: 'secret' },
      });
    });

    it('uses secure=true when the port is 465', async () => {
      await build({ ...fullSmtpConfig, MAIL_PORT: '465' });

      await service.sendSignupVerificationCode('user@example.com', '123456');

      expect(mockedCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 465, secure: true }),
      );
    });

    it('caches the transport across multiple sends', async () => {
      await build({ ...fullSmtpConfig });

      await service.sendSignupVerificationCode('user@example.com', '111111');
      await service.sendPasswordResetVerificationCode('user@example.com', '222222');

      expect(mockedCreateTransport).toHaveBeenCalledTimes(1);
    });
  });

  describe('send payload', () => {
    it('sends a signup code with the correct from/to/subject/text', async () => {
      await build({ ...fullSmtpConfig });

      await service.sendSignupVerificationCode('user@example.com', '123456');

      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@example.com',
        to: 'user@example.com',
        subject: '[SudoCampus] Signup verification code',
        text: 'Your verification code is 123456.',
      });
    });

    it('sends a password reset code with the correct subject', async () => {
      await build({ ...fullSmtpConfig });

      await service.sendPasswordResetVerificationCode('user@example.com', '654321');

      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@example.com',
        to: 'user@example.com',
        subject: '[SudoCampus] Password reset verification code',
        text: 'Your verification code is 654321.',
      });
    });
  });

  describe('dev fallback when SMTP is not configured', () => {
    it('logs the code and skips sending in non-production', async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      await build({ NODE_ENV: 'development' });

      await service.sendSignupVerificationCode('user@example.com', '123456');

      expect(sendMail).not.toHaveBeenCalled();
      expect(mockedCreateTransport).not.toHaveBeenCalled();
      const logged = warnSpy.mock.calls[0][0] as string;
      expect(logged).toContain('auth.verification_code.dev_fallback');
      expect(logged).toContain('123456');

      warnSpy.mockRestore();
    });

    it('throws in production when SMTP is not configured', async () => {
      await build({ NODE_ENV: 'production' });

      await expect(
        service.sendSignupVerificationCode('user@example.com', '123456'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('send failures', () => {
    it('propagates errors thrown by the transport', async () => {
      await build({ ...fullSmtpConfig });
      sendMail.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.sendSignupVerificationCode('user@example.com', '123456'),
      ).rejects.toThrow('smtp down');
    });

    it('throws when MAIL_PORT is not an integer', async () => {
      await build({ ...fullSmtpConfig, MAIL_PORT: 'not-a-number' });

      await expect(
        service.sendSignupVerificationCode('user@example.com', '123456'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(mockedCreateTransport).not.toHaveBeenCalled();
    });
  });
});

// Keep the imported default referenced so the mock binding is exercised.
void nodemailer;
