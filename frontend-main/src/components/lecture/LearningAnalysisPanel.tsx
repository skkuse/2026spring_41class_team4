import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DocumentQuizResponseDto } from '../../types/quiz';

interface LearningAnalysisPanelProps {
  strongKeywords: string[];
  weakKeywords: string[];
  masteryScore: number;
  coverageScore: number;
  previousQuizzes?: DocumentQuizResponseDto[];
  onStartQuiz: () => void;
}

export const MiniCircularProgress = ({ 
  title, 
  percentage, 
  colorClass 
}: { 
  title: string; 
  percentage: number; 
  colorClass: string; 
}) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-gray-600 font-bold text-xs uppercase">{title}</span>
      <div className="relative flex items-center justify-center w-[64px] h-[64px]">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" className="text-gray-200"/>
          <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={`transition-all duration-1000 ease-out ${colorClass}`} strokeLinecap="round"/>
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-gray-800">
            {percentage}<span className="text-[10px] text-gray-500 font-normal">%</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export function LearningAnalysisPanel({ 
  strongKeywords, 
  weakKeywords, 
  masteryScore, 
  coverageScore, 
  previousQuizzes = [],
  onStartQuiz 
}: LearningAnalysisPanelProps) {
  const [isFloatingOpen, setIsFloatingOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div 
      className={`absolute bottom-8 right-8 w-[400px] bg-white border border-gray-300 rounded shadow-lg transition-transform duration-300 flex flex-col overflow-hidden z-20 ${
        isFloatingOpen ? 'translate-y-0' : 'translate-y-[calc(100%-40px)] cursor-pointer'
      }`}
      onClick={!isFloatingOpen ? () => setIsFloatingOpen(true) : undefined}
    >
      {/* Toggle Handler */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsFloatingOpen(!isFloatingOpen); }}
        className="w-full flex items-center justify-center py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 bg-gray-100 text-gray-600"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={`transition-transform duration-300 ${isFloatingOpen ? 'rotate-180' : ''}`}
        >
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </button>

      <div className="p-5 space-y-4">
        {/* Keywords */}
        <div className="space-y-2 overflow-y-auto max-h-[80px] pr-2">
          <div className="flex items-start gap-2 flex-col">
            <span className="text-xs font-bold text-gray-500 uppercase">강한 키워드</span>
            {strongKeywords.length === 0 ? (
              <span className="text-xs text-gray-400">분석 완료된 강한 키워드가 없습니다.</span>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {strongKeywords.map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 flex-col">
            <span className="text-xs font-bold text-gray-500 uppercase">약한 키워드</span>
            {weakKeywords.length === 0 ? (
              <span className="text-xs text-gray-400">분석 완료된 약한 키워드가 없습니다.</span>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {weakKeywords.map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Mastery, Coverage, Quiz */}
        <div className="flex items-center gap-6 justify-between">
          <div className="flex gap-6">
            <MiniCircularProgress title="Mastery" percentage={masteryScore} colorClass="text-blue-600" />
            <MiniCircularProgress title="Coverage" percentage={coverageScore} colorClass="text-green-600" />
          </div>
          
          {/* Quiz Button */}
          <div className="flex-1 ml-4">
            <button 
              onClick={onStartQuiz} 
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-center rounded transition-colors text-sm"
            >
              단원 퀴즈 풀기
            </button>
          </div>
        </div>

        {/* Previous Quizzes List */}
        {previousQuizzes.length > 0 && (
          <>
            <hr className="border-gray-200" />
            <div className="space-y-3">
              <button 
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="w-full flex items-center justify-between text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors"
              >
                <span>이전 퀴즈 내역 ({previousQuizzes.length})</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isHistoryOpen ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              
              {isHistoryOpen && (
                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-2 animate-in slide-in-from-top-2 fade-in duration-200">
                  {previousQuizzes.map((quiz) => (
                    <Link
                      key={quiz.quizId}
                      href={quiz.latestAttempt ? `/exam/${quiz.latestAttempt.attemptId}/review?returnUrl=${pathname}` : '#'}
                      className={`block border border-gray-200 rounded p-3 hover:bg-gray-50 transition-colors ${!quiz.latestAttempt ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-800">{quiz.title}</span>
                        <span className="text-xs font-bold text-blue-600">
                          {quiz.latestAttempt?.score !== null && quiz.latestAttempt?.score !== undefined ? `${quiz.latestAttempt.score}점` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                        <span>
                          {quiz.latestAttempt?.status === 'GRADED' ? '채점 완료' :
                           quiz.latestAttempt?.status === 'SUBMITTED' ? '제출 완료' : 
                           quiz.latestAttempt?.status === 'IN_PROGRESS' ? '진행 중' : '-'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
