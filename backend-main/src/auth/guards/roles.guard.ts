import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../user/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload; ip?: string }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (requiredRoles.includes(user.role)) {
      return true;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'authz.role_denied',
        userId: user.sub,
        role: user.role,
        requiredRoles,
        ip: request.ip ?? 'unknown',
        result: 'denied',
      }),
    );
    throw new ForbiddenException('Insufficient role.');
  }
}
