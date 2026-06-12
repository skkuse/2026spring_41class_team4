import { UserRole } from '../../user/enums/user-role.enum';
import { UserStatus } from '../../user/enums/user-status.enum';

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResultDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

export interface SuccessResponse {
  success: boolean;
}
