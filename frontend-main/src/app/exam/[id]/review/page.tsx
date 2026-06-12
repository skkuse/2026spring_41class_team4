"use client";

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useExamReview } from '../../../../hooks/useExamReview';
import { ReviewHeader } from '../../../../components/exam/ReviewHeader';
import { QuestionResultCard } from '../../../../components/exam/QuestionResultCard';
import { Spinner } from '../../../../components/ui/Spinner';

export default function ExamReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const attemptId = params.id as string;
  const returnUrl = searchParams.get('returnUrl');
  
  const { reviewData, isLoading } = useExamReview(attemptId);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  if (isLoading || !reviewData) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans">
        <Spinner size="lg" className="border-gray-200" />
        <p className="mt-4 text-sm font-bold text-gray-500">채점 결과를 불러오는 중...</p>
      </div>
    );
  }

  const selectedQuestionResult = reviewData.results.find(q => q.question.id === selectedQuestionId);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans flex flex-col overflow-hidden">
      
      {/* Top Header via Component */}
      <ReviewHeader 
        finalScore={reviewData.finalScore}
        subjectTitle={reviewData.title}
        subjectId={reviewData.subjectId}
        returnUrl={returnUrl}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative p-4 md:p-8">
         <div className="max-w-4xl mx-auto space-y-4 pb-20">
            
            {reviewData.results.map((result, idx) => (
               <QuestionResultCard 
                 key={result.question.id}
                 questionResult={result}
                 index={idx}
                 isActive={selectedQuestionId === result.question.id}
                 onClick={() => setSelectedQuestionId(result.question.id)}
               />
            ))}

         </div>
      </div>

      {/* Right Side Explanation Modal */}
      {selectedQuestionId !== null && selectedQuestionResult && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-gray-900/40"
            onClick={() => setSelectedQuestionId(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white border-l border-gray-200 shadow-xl flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right-full">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
               <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                 문제 해설
               </h3>
               <button onClick={() => setSelectedQuestionId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
               <div>
                  <div className="flex flex-wrap gap-1 mb-2">
                     {selectedQuestionResult.keywords.map((kw, i) => (
                       <span key={i} className="text-[11px] bg-gray-200 px-2 py-0.5 rounded text-gray-700 font-bold">
                         # {kw}
                       </span>
                     ))}
                  </div>
                  <h4 className="text-[15px] font-bold text-gray-800 mt-2">
                    {selectedQuestionResult.question.text}
                  </h4>
               </div>

               <hr className="border-gray-200" />

               <div className="bg-blue-50 border border-blue-200 p-4 rounded text-sm text-gray-800 whitespace-pre-wrap">
                  <span className="block text-[12px] font-bold text-blue-700 uppercase mb-2">해설 내용</span>
                  {selectedQuestionResult.explanation}
               </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
               <button 
                 onClick={() => setSelectedQuestionId(null)}
                 className="w-full py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
               >
                 닫기
               </button>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
