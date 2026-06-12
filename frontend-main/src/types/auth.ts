export interface UserProfile {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string;
  role?: "USER" | "ADMIN";
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
}

export interface AuthResponse {
  user: UserProfile;
  token?: string; // 예전 코드 터질까봐 일단 냅둠
  accessToken?: string;
  refreshToken?: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  verificationCode: string;
}

export interface UpdateUserRequest {
  name?: string;
  profileImageUrl?: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface FindIdRequest {
  email: string;
  name: string;
}

export interface FindIdResponse {
  found: boolean;
  email: string | null;
}

export interface PasswordResetConfirmRequest {
  email: string;
  name: string;
  verificationCode: string;
  newPassword: string;
}
