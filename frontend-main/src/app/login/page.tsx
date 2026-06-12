"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthForm } from './components/AuthForm';
import { SocialLoginGroup } from './components/SocialLoginGroup';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  const toggleMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900 font-sans p-6">
      
      {/* Back to Home Link */}
      <div className="absolute top-4 left-4 z-20">
         <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            홈으로 이동
         </Link>
      </div>

      <div className="w-full max-w-md bg-white border border-gray-200 rounded p-6 shadow-sm z-10">
        
        {/* Logo Area */}
        <div className="text-center mb-4">
           <h1 className="text-2xl font-bold text-gray-800 mb-1">
              SudoCampus
           </h1>
           <p className="text-gray-500 text-sm">AI 통합 학습 플랫폼</p>
        </div>

        {/* Auth Toggle Tabs */}
        <ul className="flex list-none p-0 m-0 mb-4 border-b border-gray-200">
           <li className="flex-1 text-center">
             <button 
               onClick={() => toggleMode(true)}
               className={`w-full py-2 text-sm font-semibold transition-colors border-b-2 ${isLogin ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
             >
               로그인
             </button>
           </li>
           <li className="flex-1 text-center">
             <button 
               onClick={() => toggleMode(false)}
               className={`w-full py-2 text-sm font-semibold transition-colors border-b-2 ${!isLogin ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
             >
               회원가입
             </button>
           </li>
        </ul>

        {/* Auth Form Component */}
        <AuthForm isLoginMode={isLogin} />

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
           <hr className="flex-1 border-gray-200" />
           <span className="text-xs text-gray-500 uppercase">or</span>
           <hr className="flex-1 border-gray-200" />
        </div>

        {/* Social Login Component */}
        <SocialLoginGroup />

      </div>
    </div>
  );
}
