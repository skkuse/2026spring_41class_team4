import { UserRole } from '../../user/enums/user-role.enum';
import { UserStatus } from '../../user/enums/user-status.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  type: 'access' | 'refresh';
  tokenType?: 'access' | 'refresh';
  iss?: string;
  aud?: string | string[];
  jti?: string;
}
