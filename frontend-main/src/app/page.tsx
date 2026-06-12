"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubjectCard } from '../components/SubjectCard';
import { useSubjects } from '../hooks/useSubjects';
import { useAuth } from '../hooks/useAuth';

export default function SubjectListPage() {
  const { subjects, isLoading: isSubjectsLoading, removeSubject } = useSubjects();
  const { isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500 font-medium">인증 정보를 확인 중입니다...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will be redirected
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex-1 w-full min-h-screen bg-gray-100 text-gray-900 font-sans">
      {/* 1. Navbar */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 md:px-8 py-3 w-full border-b border-gray-200 bg-white">
        <div className="flex items-center">
          <Link href="/" className="text-lg font-bold text-gray-800 text-decoration-none">
            SudoCampus
          </Link>
        </div>
        
        {/* Right Info */}
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            className="flex items-center justify-center p-2 rounded text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-300 transition-colors"
            aria-label="사용자 프로필"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          <button 
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="px-4 md:px-8 py-8 max-w-7xl mx-auto w-full">
        
        <h2 className="text-xl font-bold mb-4 text-gray-800">내 과목 목록</h2>
        
        {isSubjectsLoading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500 font-medium">과목 목록을 불러오는 중...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* Subject Cards */}
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                id={subject.id}
                title={subject.title}
                thumbnail={subject.imageUrl}
                masteryScore={subject.progress}
                onDelete={() => removeSubject(subject.id)}
              />
            ))}

            {/* Add Subject Card */}
            <Link href="/new" className="flex flex-col items-center justify-center min-h-[12rem] bg-gray-50 border-2 border-dashed border-gray-300 rounded hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-600 transition-colors cursor-pointer text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              <span className="text-sm font-medium">과목 추가</span>
            </Link>

          </div>
        )}
      </main>
    </div>
  );
}
