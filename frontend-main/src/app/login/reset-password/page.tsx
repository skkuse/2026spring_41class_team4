"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '../../../services/authService';

export default function ResetPasswordPage() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRequestCode = async () => {
    setError('');
    setSuccessMessage('');
    
    if (!name || !email) {
      setError('이름과 이메일을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.requestPasswordResetCode({ name, email });
      if (response.success) {
        setIsCodeSent(true);
        setSuccessMessage('비밀번호 재설정 인증번호가 발송되었습니다. 이메일을 확인해주세요.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '인증번호 발송 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!isCodeSent) {
      setError('먼저 인증번호를 요청해주세요.');
      return;
    }

    if (!verificationCode || !newPassword) {
      setError('인증번호와 새 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.confirmPasswordReset({
        email,
        name,
        verificationCode,
        newPassword
      });
      if (response.success) {
        setSuccessMessage('비밀번호가 성공적으로 재설정되었습니다. 로그인 페이지로 이동합니다.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '비밀번호 재설정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900 font-sans p-6">
      
      {/* Back to Login Link */}
      <div className="absolute top-4 left-4 z-20">
         <Link href="/login" className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            로그인으로 돌아가기
         </Link>
      </div>

      <div className="w-full max-w-md bg-white border border-gray-200 rounded p-6 shadow-sm z-10">
        <div className="text-center mb-6">
           <h1 className="text-xl font-bold text-gray-800 mb-1">
              비밀번호 재설정
           </h1>
           <p className="text-gray-500 text-sm">가입 시 입력한 이름과 이메일을 인증해주세요.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">이름</label>
            <input 
              type="text" 
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCodeSent}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:bg-gray-100"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isCodeSent}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:bg-gray-100"
              />
              {!isCodeSent && (
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={isLoading}
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  인증번호 발송
                </button>
              )}
            </div>
          </div>

          {isCodeSent && (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">인증번호</label>
                <input 
                  type="text" 
                  placeholder="인증번호 6자리"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">새 비밀번호</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-red-500 text-sm font-medium pt-1">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="text-blue-600 text-sm font-medium pt-1 p-3 bg-blue-50 border border-blue-100 rounded">
              {successMessage}
            </div>
          )}

          {isCodeSent && (
            <div className="pt-2">
               <button 
                 type="submit"
                 disabled={isLoading}
                 className="w-full block text-center py-2 px-4 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
               >
                 {isLoading ? '처리 중...' : '비밀번호 재설정'}
               </button>
            </div>
          )}
        </form>

      </div>
    </div>
  );
}
