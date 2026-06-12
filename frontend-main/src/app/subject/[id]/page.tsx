"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSubjectDashboard } from '../../../hooks/useSubjectDashboard';
import { Sidebar } from '../../../components/subject/Sidebar';
import { ProgressCard } from '../../../components/subject/ProgressCard';
import { KeywordAnalysisCard } from '../../../components/subject/KeywordAnalysisCard';
import { MockExamCard } from '../../../components/subject/MockExamCard';
import { lectureService } from '../../../services/lectureService';
import { Spinner } from '../../../components/ui/Spinner';

export default function SubjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;

  const { dashboardData, isLoading, error } = useSubjectDashboard(subjectId);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'analyzing' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('파일을 선택해주세요.');
      return;
    }
    
    try {
      setUploadState('uploading');
      setUploadError(null);
      // 1. Upload PDF
      const uploadRes = await lectureService.uploadDocument(subjectId, selectedFile);
      
      // 2. Analyze Document
      setUploadState('analyzing');
      await lectureService.analyzeDocument(uploadRes.documentId);
      
      // 3. Success, close modal and redirect to lecture detail
      setIsUploadModalOpen(false);
      setUploadState('idle');
      setSelectedFile(null);
      
      router.push(`/subject/${subjectId}/lecture/${uploadRes.documentId}`);
      
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setUploadState('error');
      setUploadError(err instanceof Error ? err.message : '업로드 및 분석 중 오류가 발생했습니다.');
    }
  };

  const closeUploadModal = () => {
    if (uploadState === 'uploading' || uploadState === 'analyzing') return;
    setIsUploadModalOpen(false);
    setUploadState('idle');
    setSelectedFile(null);
    setUploadError(null);
  };

  // 1. Simple Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <p className="text-sm font-bold text-gray-500 animate-pulse">
            대시보드를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  // 2. Simple Error State
  if (error || !dashboardData) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans p-6 text-center">
        <div className="max-w-md bg-white border border-gray-200 rounded p-8 shadow-sm flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">오류가 발생했습니다</h3>
          <p className="text-sm text-gray-500 mb-6">
            {error || '대시보드 데이터를 조회할 수 없습니다.'}
          </p>
          <div className="flex gap-3">
            <Link 
              href="/" 
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              메인으로 이동
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Callbacks
  const handleSelectLecture = (lectureId: string) => {
    router.push(`/subject/${subjectId}/lecture/${lectureId}`);
  };

  const handleTakeExam = () => {
    router.push(`/subject/${subjectId}/exam/setup`);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden relative">
      
      {/* Header */}
      <header className="flex-none px-4 md:px-8 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="메인 화면으로 돌아가기">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-800">{dashboardData.subjectName}</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar 
          lectures={dashboardData.lectures}
          onAddMaterial={() => setIsUploadModalOpen(true)}
          onSelectLecture={handleSelectLecture}
        />

        {/* Dashboard Main View */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
          <div className="max-w-5xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              대시보드
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column */}
              <div className="flex flex-col gap-8">
                <ProgressCard 
                  mastery={dashboardData.mastery}
                  coverage={dashboardData.coverage}
                />

                <KeywordAnalysisCard 
                  strongKeywords={dashboardData.strongKeywords}
                  weakKeywords={dashboardData.weakKeywords}
                />
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-8">
                <MockExamCard 
                  history={dashboardData.history}
                  onTakeExam={handleTakeExam}
                />
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" 
            onClick={closeUploadModal}
          />
          
          <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded p-6 shadow-lg z-10">
             
             <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                <h3 className="text-lg font-bold text-gray-800">
                  강의자료 업로드
                </h3>
                <button 
                  onClick={closeUploadModal}
                  disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
             </div>

             <form onSubmit={handleUploadSubmit}>
                <p className="text-sm text-gray-600 mb-4">
                  PDF 형식의 강의 슬라이드, 필기 노트 등을 업로드하세요. <br/>
                  AI가 즉시 내용을 스캔하여 키워드를 추출하고 맞춤 퀴즈를 준비합니다.
                </p>

                <div className="mb-4">
                   <input 
                     type="file" 
                     accept="application/pdf"
                     onChange={handleFileChange}
                     disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
                     className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-gray-50 border border-gray-300 rounded cursor-pointer p-2 disabled:opacity-50"
                   />
                   <p className="text-xs text-gray-500 mt-2">MAX 50MB</p>
                   {uploadError && <p className="text-sm text-red-500 mt-2">{uploadError}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                   <button 
                     type="button" 
                     onClick={closeUploadModal}
                     disabled={uploadState === 'uploading' || uploadState === 'analyzing'}
                     className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                   >
                     취소
                   </button>
                   <button 
                     type="submit" 
                     disabled={uploadState === 'uploading' || uploadState === 'analyzing' || !selectedFile}
                     className="px-4 py-2 border border-transparent rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                   >
                     {uploadState === 'uploading' && (
                       <Spinner size="sm" className="border-white border-t-transparent" />
                     )}
                     {uploadState === 'analyzing' && (
                       <Spinner size="sm" className="border-white border-t-transparent" />
                     )}
                     {uploadState === 'uploading' ? '업로드 중...' : uploadState === 'analyzing' ? 'AI 분석 중...' : '업로드 및 AI 분석'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
