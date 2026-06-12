import { AuthResponse, UserProfile, GoogleLoginRequest, LoginCredentials, RegisterCredentials, UpdateUserRequest, SuccessResponse, FindIdRequest, FindIdResponse, PasswordResetConfirmRequest } from '../types/auth';
import { apiClient, setTokens, clearTokens } from './apiClient';

class AuthService {
  // --- 원래 있던 일반 로그인 살림 ---
  async postLogin(credentials: LoginCredentials): Promise<AuthResponse> {

    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const data = response.data;
      if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
      }
      return data;
    } catch {
      throw new Error('로그인에 실패했습니다.');
    }
  }

  // --- 원래 있던 일반 회원가입 살림 ---
  async postRegister(credentials: RegisterCredentials): Promise<SuccessResponse> {

    try {
      const response = await apiClient.post<SuccessResponse>('/auth/register', credentials);
      return response.data;
    } catch {
      throw new Error('회원가입에 실패했습니다.');
    }
  }

  // --- 인증이랑 비번찾기 잡동사니 ---
  async requestRegisterVerificationCode(email: string): Promise<SuccessResponse> {
    try {
      const response = await apiClient.post<SuccessResponse>('/auth/register/verification-code', { email });
      return response.data;
    } catch {
      throw new Error('인증번호 발송에 실패했습니다.');
    }
  }

  async findId(data: FindIdRequest): Promise<FindIdResponse> {
    try {
      const response = await apiClient.post<FindIdResponse>('/auth/find-id', data);
      return response.data;
    } catch {
      throw new Error('아이디 찾기에 실패했습니다.');
    }
  }

  async requestPasswordResetCode(data: FindIdRequest): Promise<SuccessResponse> {
    try {
      const response = await apiClient.post<SuccessResponse>('/auth/password-reset/verification-code', data);
      return response.data;
    } catch {
      throw new Error('인증번호 발송에 실패했습니다.');
    }
  }

  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<SuccessResponse> {
    try {
      const response = await apiClient.post<SuccessResponse>('/auth/password-reset/confirm', data);
      return response.data;
    } catch {
      throw new Error('비밀번호 재설정에 실패했습니다.');
    }
  }

  // --- 새로 붙인 구글 로그인 ---
  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const requestBody: GoogleLoginRequest = { idToken };
    
    try {
      const response = await apiClient.post<AuthResponse>('/auth/google', requestBody);
      const data = response.data;
      if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
      }
      return data;
    } catch {
      throw new Error('Google login failed');
    }
  }

  // --- 공통으로 쓰는 애들 ---
  async getCurrentUser(): Promise<UserProfile> {
    try {
      const response = await apiClient.get<UserProfile>('/users/me');
      return response.data;
    } catch {
      throw new Error('Failed to get current user');
    }
  }

  async updateCurrentUser(data: UpdateUserRequest): Promise<UserProfile> {
    try {
      const response = await apiClient.patch<UserProfile>('/users/me', data);
      return response.data;
    } catch {
      throw new Error('Failed to update current user');
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed on server, clearing local tokens anyway', error);
    } finally {
      clearTokens();
    }
  }

  async getGoogleAuthUrl(): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?mock=true';
  }
}

export const authService = new AuthService();
