import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthVerificationCode } from './entities/auth-verification-code.entity';
import { OauthAccount } from './entities/oauth-account.entity';
import { PasswordCredential } from './entities/password-credential.entity';
import { MailService } from './mail.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { VerificationCodeService } from './verification-code.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UserModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured.');
        }
        const issuer = configService.get<string>('JWT_ISSUER');
        const audience = configService.get<string>('JWT_AUDIENCE');
        if (!issuer || !audience) {
          throw new Error('JWT_ISSUER and JWT_AUDIENCE must be configured.');
        }

        return {
          secret,
          signOptions: {
            issuer,
            audience,
          },
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      OauthAccount,
      PasswordCredential,
      AuthVerificationCode,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, VerificationCodeService, MailService],
  exports: [AuthService],
})
export class AuthModule {}
