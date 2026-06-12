"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMockExam } from '../../../../../hooks/useMockExam';
import { useSubjectDashboard } from '../../../../../hooks/useSubjectDashboard';
import { Lecture } from '../../../../../types/subject';
import { useToast } from '../../../../../contexts/ToastContext';
import { Spinner } from '../../../../../components/ui/Spinner';

export default function MockExamSetupPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;
  const { showToast } = useToast();

  const { dashboardData } = useSubjectDashboard(subjectId);
  const { masteryData, isGenerating, generatePersonalizedExam } = useMockExam(subjectId);

  const [selectedLectures, setSelectedLectures] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Initialize selected lectures to all available lectures
  useEffect(() => {
    if (dashboardData && dashboardData.lectures.length > 0 && selectedLectures.length === 0) {
      const timer = setTimeout(() => {
        setSelectedLectures(dashboardData.lectures.map(l => l.id));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [dashboardData, selectedLectures.length]);

  const handleRangeToggle = (id: string) => {
    setSelectedLectures(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedLectures.length === 0) {
      showToast('최소 한 개의 단원을 선택해 주세요.', 'error');
      return;
    }

    const quizId = await generatePersonalizedExam({
      quizProblemCount: questionCount,
      documentIds: selectedLectures,
      targetWeakKeywords: true
    });

    if (quizId) {
      router.push(`/subject/${subjectId}/exam/take?quizId=${quizId}`);
    }
  };

  if (!dashboardData || !masteryData) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans">
        <Spinner size="lg" className="border-gray-200" />
        <p className="mt-4 text-sm font-bold text-gray-500">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans flex flex-col items-center py-10 px-4 relative">
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-gray-900/40 flex flex-col items-center justify-center backdrop-blur-sm">
           <div className="bg-white p-8 rounded shadow-lg flex flex-col items-center">
             <Spinner size="xl" className="border-gray-200 mb-4" />
             <h3 className="text-lg font-bold text-gray-800 mb-2">AI 맞춤형 모의고사 생성 중</h3>
             <p className="text-sm text-gray-500">학습자의 약점 키워드를 분석하여 문제를 출제하고 있습니다.</p>
           </div>
        </div>
      )}

      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
         {/* Header */}
         <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-800">맞춤형 모의고사 설정</h1>
            <Link href={`/subject/${subjectId}`} className="text-sm font-bold text-gray-500 hover:text-gray-800">
              대시보드로 돌아가기
            </Link>
         </div>

         <div className="p-6 md:p-8 space-y-8">
            
            {/* Mastery Info Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4 flex gap-4 items-center">
               <div className="flex-1">
                 <h3 className="text-[13px] font-bold text-blue-800 uppercase mb-2">나의 학습 현황 요약</h3>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm text-gray-700">종합 숙련도: <span className="font-bold text-blue-700">{Math.round(masteryData.mastery * 100)}%</span></span>
                    <div className="text-sm text-gray-700 flex gap-2 items-start border-t border-blue-200 pt-3">
                      <span className="shrink-0 mt-0.5">주요 약점:</span>
                      <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pr-2 custom-scrollbar">
                        {masteryData.weakKeywords.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 text-[11px] rounded font-bold whitespace-nowrap">{kw.name}</span>
                        ))}
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Range Selection */}
            <div>
               <h3 className="text-sm font-bold text-gray-800 mb-3">출제 범위 (단원 선택)</h3>
               <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded p-2">
                 {dashboardData.lectures.map((lecture: Lecture) => (
                   <label key={lecture.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                     <input 
                       type="checkbox"
                       checked={selectedLectures.includes(lecture.id)}
                       onChange={() => handleRangeToggle(lecture.id)}
                       className="w-4 h-4 text-blue-600 rounded border-gray-300"
                     />
                     <span className="text-sm text-gray-700">{lecture.title}</span>
                   </label>
                 ))}
               </div>
            </div>

            {/* Question Count Selection */}
            <div>
               <h3 className="text-sm font-bold text-gray-800 mb-3">문항 수 선택</h3>
               <div className="flex gap-4">
                 {[5, 10, 15, 20].map(count => (
                   <label key={count} className={`flex-1 border rounded p-3 text-center cursor-pointer transition-colors ${questionCount === count ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                     <input 
                       type="radio" 
                       name="qCount" 
                       className="hidden" 
                       checked={questionCount === count} 
                       onChange={() => setQuestionCount(count)}
                     />
                     {count}문제
                   </label>
                 ))}
               </div>
            </div>

         </div>

         {/* Footer */}
         <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
            <button
              onClick={handleGenerate}
              className="px-6 py-2 rounded text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              맞춤형 모의고사 생성
            </button>
         </div>
      </div>
    </div>
  );
}
