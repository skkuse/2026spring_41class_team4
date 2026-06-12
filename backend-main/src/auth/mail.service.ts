import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendSignupVerificationCode(email: string, code: string): Promise<void> {
    await this.sendVerificationCode({
      email,
      code,
      subject: '[SudoCampus] Signup verification code',
      context: 'signup',
    });
  }

  async sendPasswordResetVerificationCode(
    email: string,
    code: string,
  ): Promise<void> {
    await this.sendVerificationCode({
      email,
      code,
      subject: '[SudoCampus] Password reset verification code',
      context: 'password-reset',
    });
  }

  private async sendVerificationCode(input: {
    email: string;
    code: string;
    subject: string;
    context: 'signup' | 'password-reset';
  }): Promise<void> {
    const smtpConfigured = this.hasSmtpConfig();
    if (!smtpConfigured) {
      const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
      if (nodeEnv !== 'production') {
        this.logger.warn(
          JSON.stringify({
            event: 'auth.verification_code.dev_fallback',
            context: input.context,
            email: input.email,
            code: input.code,
            mode: 'log-only',
          }),
        );
        return;
      }

      throw new InternalServerErrorException(
        'Mail service is not configured in production.',
      );
    }

    const transporter = this.getTransporter();
    const from = this.configService.get<string>('MAIL_FROM');
    if (!from) {
      throw new InternalServerErrorException('MAIL_FROM is required.');
    }

    await transporter.sendMail({
      from,
      to: input.email,
      subject: input.subject,
      text: `Your verification code is ${input.code}.`,
    });
  }

  private hasSmtpConfig(): boolean {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<string>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    const from = this.configService.get<string>('MAIL_FROM');
    return Boolean(host && port && user && pass && from);
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('MAIL_HOST');
    const portRaw = this.configService.get<string>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    if (!host || !portRaw || !user || !pass) {
      throw new InternalServerErrorException(
        'MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD are required.',
      );
    }

    const port = Number.parseInt(portRaw, 10);
    if (!Number.isInteger(port)) {
      throw new InternalServerErrorException('MAIL_PORT must be an integer.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }
}
