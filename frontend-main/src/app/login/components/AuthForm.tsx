"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';

interface AuthFormProps {
  isLoginMode: boolean;
}

export function AuthForm({ isLoginMode }: AuthFormProps) {
  const router = useRouter();
  const { login, register, requestRegisterVerificationCode, isLoading, error, setError } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 탭 변경 시 상태 초기화
  useEffect(() => {
    const timer = setTimeout(() => {
      setValidationError('');
      setSuccessMessage('');
      setError(null);
      if (!isLoginMode) {
        setIsCodeSent(false);
        setVerificationCode('');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoginMode, setError]);

  const validateEmail = (): boolean => {
    setValidationError('');
    if (!email) {
      setValidationError('이메일을 입력해주세요.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('유효한 이메일 형식이 아닙니다.');
      return false;
    }
    return true;
  };

  const handleRequestCode = async () => {
    if (!validateEmail()) return;
    setSuccessMessage('');
    
    const success = await requestRegisterVerificationCode(email);
    if (success) {
      setIsCodeSent(true);
      setSuccessMessage('인증번호가 발송되었습니다. 이메일을 확인해주세요.');
    }
  };

  const validate = (): boolean => {
    setValidationError('');
    if (!validateEmail()) return false;
    if (!password) {
      setValidationError('비밀번호를 입력해주세요.');
      return false;
    }
    if (!isLoginMode) {
      if (!isCodeSent) {
        setValidationError('먼저 인증번호를 요청해주세요.');
        return false;
      }
      if (!verificationCode) {
        setValidationError('인증번호를 입력해주세요.');
        return false;
      }
      if (!name) {
        setValidationError('이름을 입력해주세요.');
        return false;
      }
    }
    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    setSuccessMessage('');

    if (isLoginMode) {
      const success = await login({ email, password });
      if (success) {
        router.push('/');
      }
    } else {
      const success = await register({ name, email, password, verificationCode });
      if (success) {
        setSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
        // 상태 초기화
        setIsCodeSent(false);
        setName('');
        setPassword('');
        setVerificationCode('');
        // 부모 컴포넌트에서 isLoginMode를 제어하므로 여기서는 메시지만 표시하거나,
        // 필요 시 페이지 리로드 또는 부모 상태 변경 함수를 호출해야 함.
        // 현재는 메시지 표시 후 사용자가 직접 로그인 탭으로 이동하도록 유도.
      }
    }
  };

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      
      {/* 이메일 입력 (공통) */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">이메일</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoginMode ? false : isCodeSent}
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:bg-gray-100"
          />
          {!isLoginMode && !isCodeSent && (
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

      {!isLoginMode && isCodeSent && (
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
             <label className="block text-sm font-medium text-gray-700">이름</label>
             <input 
               type="text" 
               placeholder="홍길동"
               value={name}
               onChange={(e) => setName(e.target.value)}
               className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
             />
           </div>
         </>
      )}

      {/* 비밀번호 입력 (공통: 로그인이거나, 회원가입 시 인증번호 발송 후에만 노출) */}
      {(isLoginMode || isCodeSent) && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">비밀번호</label>
          <input 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
          />
        </div>
      )}

      {/* Error / Success Messages */}
      {(validationError || error) && (
        <div className="text-red-500 text-sm font-medium pt-1">
          {validationError || error}
        </div>
      )}
      {successMessage && (
        <div className="text-blue-600 text-sm font-medium pt-1">
          {successMessage}
        </div>
      )}

      {/* 로그인 시 아이디/비밀번호 찾기 링크 */}
      {isLoginMode && (
        <div className="flex justify-end text-xs text-gray-500 space-x-2 pt-1">
          <Link href="/login/find-id" className="hover:text-gray-800 transition-colors">아이디 찾기</Link>
          <span>|</span>
          <Link href="/login/reset-password" className="hover:text-gray-800 transition-colors">비밀번호 찾기</Link>
        </div>
      )}

      <div className="pt-2">
         <button 
           type="submit"
           disabled={isLoading || (!isLoginMode && !isCodeSent)}
           className="w-full block text-center py-2 px-4 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
         >
           {isLoading ? '처리 중...' : (isLoginMode ? '로그인' : '회원가입')}
         </button>
      </div>
    </form>
  );
}
