import React from 'react';
import Link from 'next/link';
import { MockExamListItem } from '../../types/exam';

interface MockExamCardProps {
  history: MockExamListItem[];
  onTakeExam: () => void;
}

export function MockExamCard({ history, onTakeExam }: MockExamCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded p-6 shadow-sm h-full">
      <h3 className="text-lg font-bold text-gray-800 mb-4">모의고사</h3>
      
      <button 
        onClick={onTakeExam} 
        className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors mb-8"
      >
        모의고사 풀기
      </button>

      <h4 className="text-sm font-bold text-gray-500 mb-2 border-b border-gray-200 pb-2">최근 푼 모의고사</h4>
      
      {history.length === 0 ? (
        <p className="text-xs text-gray-400 py-3">아직 응시한 모의고사가 없습니다.</p>
      ) : (
        <div className="flex flex-col">
          {history.map((exam, idx) => {
            const latest = exam.latestAttempt;
            const isGraded = latest && latest.status === 'GRADED';
            const isStarted = latest !== null;
            
            // 링크 목적지: 시도 내역이 없으면 문제 풀이 진입, 있으면 리뷰 화면
            const href = isStarted 
              ? `/exam/${latest.attemptId}/review?returnUrl=/subject/${exam.subjectId}` 
              : `/subject/${exam.subjectId}/exam/take?quizId=${exam.quizId}`;
              
            // 상태 텍스트
            let scoreText = '-';
            if (isGraded && latest.score !== null) {
              scoreText = `${latest.score}점`;
            } else if (latest && latest.status === 'IN_PROGRESS') {
              scoreText = '진행 중';
            } else if (latest && latest.status === 'SUBMITTED') {
              scoreText = '제출됨';
            } else if (!isStarted) {
              scoreText = '미응시';
            }

            return (
              <Link 
                href={href} 
                key={exam.mockExamId}
                className={`flex items-center justify-between py-3 hover:bg-gray-50 transition-colors ${idx !== history.length - 1 ? 'border-b border-gray-200' : ''}`}
              >
                 <span className="text-gray-700 text-sm font-medium line-clamp-1 flex-1 mr-4">
                   {exam.title.replace(/mock exam/ig, '모의고사')}
                 </span>
                 <span className="text-gray-500 font-mono text-sm shrink-0">
                   {scoreText}
                 </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
