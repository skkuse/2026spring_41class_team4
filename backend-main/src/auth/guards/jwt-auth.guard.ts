import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { UserRole } from '../../user/enums/user-role.enum';
import { UserStatus } from '../../user/enums/user-status.enum';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private hasLoggedBypass = false;

  canActivate(context: ExecutionContext) {
    if (!this.shouldBypassAuth()) {
      return super.canActivate(context);
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    request.user = this.buildDevUser();

    if (!this.hasLoggedBypass) {
      this.logger.warn(
        'AUTH_DISABLE_IN_DEV=true detected. JWT auth is bypassed for non-production environment.',
      );
      this.hasLoggedBypass = true;
    }

    return true;
  }

  private shouldBypassAuth(): boolean {
    return (
      process.env.AUTH_DISABLE_IN_DEV === 'true' &&
      process.env.NODE_ENV !== 'production'
    );
  }

  private buildDevUser(): JwtPayload {
    return {
      sub: process.env.AUTH_DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001',
      email: process.env.AUTH_DEV_USER_EMAIL ?? 'dev-user@example.com',
      role: this.parseRole(process.env.AUTH_DEV_USER_ROLE),
      status: this.parseStatus(process.env.AUTH_DEV_USER_STATUS),
      tokenVersion: Number(process.env.AUTH_DEV_TOKEN_VERSION ?? 0),
      type: 'access',
    };
  }

  private parseRole(value?: string): UserRole {
    if (value === UserRole.ADMIN) {
      return UserRole.ADMIN;
    }
    return UserRole.USER;
  }

  private parseStatus(value?: string): UserStatus {
    if (value === UserStatus.SUSPENDED) {
      return UserStatus.SUSPENDED;
    }
    if (value === UserStatus.DELETED) {
      return UserStatus.DELETED;
    }
    return UserStatus.ACTIVE;
  }
}
