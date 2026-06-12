import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuthVerificationCode } from './entities/auth-verification-code.entity';
import { AuthVerificationPurpose } from './entities/auth-verification-purpose.enum';
import { VerificationDeliveryChannel } from './entities/verification-delivery-channel.enum';

@Injectable()
export class VerificationCodeService {
  constructor(
    @InjectRepository(AuthVerificationCode)
    private readonly verificationCodeRepository: Repository<AuthVerificationCode>,
    private readonly configService: ConfigService,
  ) {}

  generateNumericVerificationCode(): string {
    const length = this.getCodeLength();
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(value);
  }

  async createVerificationCode(params: {
    email: string;
    purpose: AuthVerificationPurpose;
    userId?: string | null;
    deliveryChannel?: VerificationDeliveryChannel;
  }): Promise<string> {
    const code = this.generateNumericVerificationCode();
    const codeHash = await this.hashCode(code);
    const expiresAt = this.createExpiryDate();

    const entity = this.verificationCodeRepository.create({
      userId: params.userId ?? null,
      email: this.normalizeEmail(params.email),
      purpose: params.purpose,
      codeHash,
      expiresAt,
      verifiedAt: null,
      consumedAt: null,
      attemptCount: 0,
      deliveryChannel: params.deliveryChannel ?? VerificationDeliveryChannel.EMAIL,
    });
    await this.verificationCodeRepository.save(entity);
    return code;
  }

  async verifyCodeByEmailAndPurpose(params: {
    email: string;
    purpose: AuthVerificationPurpose;
    code: string;
  }): Promise<AuthVerificationCode> {
    const normalizedEmail = this.normalizeEmail(params.email);
    const candidate = await this.verificationCodeRepository.findOne({
      where: { email: normalizedEmail, purpose: params.purpose },
      order: { createdAt: 'DESC' },
    });

    if (!candidate) {
      throw new BadRequestException('Invalid verification code.');
    }

    if (candidate.consumedAt) {
      throw new BadRequestException('Verification code has already been used.');
    }

    const maxAttempts = this.getMaxVerificationAttempts();
    if (candidate.attemptCount >= maxAttempts) {
      throw new HttpException(
        'Too many failed verification attempts.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (candidate.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired.');
    }

    const matched = await compare(params.code, candidate.codeHash);
    if (!matched) {
      candidate.attemptCount += 1;
      await this.verificationCodeRepository.save(candidate);
      if (candidate.attemptCount >= maxAttempts) {
        throw new HttpException(
          'Too many failed verification attempts.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException('Invalid verification code.');
    }

    if (!candidate.verifiedAt) {
      candidate.verifiedAt = new Date();
      await this.verificationCodeRepository.save(candidate);
    }

    return candidate;
  }

  async consumeCode(codeId: string): Promise<void> {
    const candidate = await this.verificationCodeRepository.findOne({
      where: { id: codeId },
    });

    if (!candidate) {
      throw new BadRequestException('Verification code not found.');
    }

    if (candidate.consumedAt) {
      throw new BadRequestException('Verification code has already been used.');
    }

    candidate.consumedAt = new Date();
    await this.verificationCodeRepository.save(candidate);
  }

  private async hashCode(code: string): Promise<string> {
    const rounds = this.getBcryptSaltRounds();
    return hash(code, rounds);
  }

  private createExpiryDate(): Date {
    const ttlMinutesRaw =
      this.configService.get<string>('AUTH_VERIFICATION_CODE_TTL_MINUTES') ?? '10';
    const ttlMinutes = Number.parseInt(ttlMinutesRaw, 10);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) {
      return new Date(Date.now() + 10 * 60_000);
    }
    return new Date(Date.now() + ttlMinutes * 60_000);
  }

  private getCodeLength(): number {
    const raw = this.configService.get<string>('AUTH_VERIFICATION_CODE_LENGTH') ?? '6';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 4 || parsed > 10) {
      return 6;
    }
    return parsed;
  }

  private getBcryptSaltRounds(): number {
    const rawValue = this.configService.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 4 || parsed > 31) {
      return 12;
    }
    return parsed;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getMaxVerificationAttempts(): number {
    const raw =
      this.configService.get<string>('AUTH_VERIFICATION_MAX_ATTEMPTS') ?? '5';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 5;
    }
    return parsed;
  }
}
