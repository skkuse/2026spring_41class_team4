"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { authService } from '../../../services/authService';

export default function FindIdPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResultMessage('');

    if (!name || !email) {
      setError('이름과 이메일을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.findId({ name, email });
      if (response.found && response.email) {
        setResultMessage(`회원님의 아이디는 ${response.email} 입니다.`);
      } else {
        setError('입력하신 정보와 일치하는 계정을 찾을 수 없습니다.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '아이디 찾기 중 오류가 발생했습니다.');
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
              아이디 찾기
           </h1>
           <p className="text-gray-500 text-sm">가입 시 입력한 이름과 이메일을 입력해주세요.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <input 
              type="text" 
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm font-medium pt-1">
              {error}
            </div>
          )}
          
          {resultMessage && (
            <div className="text-blue-600 text-sm font-medium pt-1 p-3 bg-blue-50 border border-blue-100 rounded">
              {resultMessage}
            </div>
          )}

          <div className="pt-2">
             <button 
               type="submit"
               disabled={isLoading}
               className="w-full block text-center py-2 px-4 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
             >
               {isLoading ? '처리 중...' : '아이디 찾기'}
             </button>
          </div>
        </form>

      </div>
    </div>
  );
}
