import { useState, useEffect } from 'react';
import { UserProfile, LoginCredentials, RegisterCredentials } from '../types/auth';
import { authService } from '../services/authService';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '../services/apiClient';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isAuthenticated = user !== null;

  useEffect(() => {
    const initSession = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch (err) {
          console.error('Session restoration failed:', err);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.postLogin(credentials);
      setUser(response.user);
      router.push('/');
      return true;
    } catch (err) {
      console.error(err);
      setError('로그인에 실패했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.postRegister(credentials);
      return response.success;
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestRegisterVerificationCode = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.requestRegisterVerificationCode(email);
      return response.success;
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.loginWithGoogle(idToken);
      setUser(response.user);
      router.push('/');
      return true;
    } catch (err) {
      console.error(err);
      setError('구글 로그인 진행 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    setError,
    login,
    register,
    requestRegisterVerificationCode,
    loginWithGoogle,
    logout,
  };
}
