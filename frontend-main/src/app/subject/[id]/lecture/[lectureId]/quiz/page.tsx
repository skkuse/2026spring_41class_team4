"use client";

import React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuizSession } from '../../../../../../hooks/useQuizSession';
import { SingleChoiceQuiz } from '../../../../../../components/quiz/SingleChoiceQuiz';
import { MultipleChoiceQuiz } from '../../../../../../components/quiz/MultipleChoiceQuiz';
import { ShortAnswerQuiz } from '../../../../../../components/quiz/ShortAnswerQuiz';
import { Spinner } from '../../../../../../components/ui/Spinner';

export default function QuizPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectId = params.id as string;
  const lectureId = params.lectureId as string;
  const quizId = searchParams.get('quizId');

  const {
    quizDetails,
    currentQuestion,
    currentIndex,
    totalQuestions,
    userAnswers,
    isLastQuestion,
    isLoading,
    isSubmitting,
    saveAnswer,
    handleNext,
    submitAll
  } = useQuizSession(quizId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <p className="text-sm font-bold text-gray-500 animate-pulse">퀴즈를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!quizDetails || !currentQuestion) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 text-gray-900 font-sans p-6 text-center">
         <div className="max-w-md bg-white border border-gray-200 rounded p-8 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">문제가 없습니다</h3>
            <p className="text-sm text-gray-500 mb-6">해당 단원의 퀴즈 데이터를 찾을 수 없습니다.</p>
            <Link 
              href={`/subject/${subjectId}/lecture/${lectureId}`} 
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              단원 상세로 돌아가기
            </Link>
         </div>
      </div>
    );
  }

  // Handle single choice selection
  const handleSingleChoiceSelect = (opt: string) => {
    saveAnswer(currentQuestion.id, opt);
  };

  // Handle multiple choice toggle
  const handleMultipleChoiceToggle = (opt: string) => {
    const currentSelected = (userAnswers[currentQuestion.id] as string[]) || [];
    if (currentSelected.includes(opt)) {
      saveAnswer(currentQuestion.id, currentSelected.filter(item => item !== opt));
    } else {
      saveAnswer(currentQuestion.id, [...currentSelected, opt]);
    }
  };

  // Handle short answer input
  const handleShortAnswerChange = (text: string) => {
    saveAnswer(currentQuestion.id, text);
  };

  // Difficulty badge coloring
  let diffBadge = null;
  if (currentQuestion.difficulty === 'HIGH') diffBadge = <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-100 text-rose-800">상</span>;
  else if (currentQuestion.difficulty === 'MEDIUM') diffBadge = <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-yellow-100 text-yellow-800">중</span>;
  else if (currentQuestion.difficulty === 'LOW') diffBadge = <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-green-100 text-green-800">하</span>;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans flex flex-col items-center py-10 px-4">
      
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
         {/* Quiz Header */}
         <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-800">{quizDetails.title}</h1>
            <div className="text-sm font-bold text-gray-500">
              <span className="text-blue-600">{currentIndex + 1}</span> / {totalQuestions}
            </div>
         </div>

         {/* Progress Bar */}
         <div className="w-full bg-gray-200 h-1.5">
            <div 
              className="bg-blue-600 h-1.5 transition-all duration-300 ease-out" 
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
         </div>

         {/* Question Content */}
         <div className="p-6 md:p-8 flex-1">
            <div className="mb-6">
               <div className="flex gap-2 mb-3">
                 <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-gray-200 text-gray-700">
                   {currentQuestion.type === 'SINGLE_CHOICE' && '객관식(단일)'}
                   {currentQuestion.type === 'MULTIPLE_CHOICE' && '객관식(다중)'}
                   {currentQuestion.type === 'SHORT_ANSWER' && '주관식'}
                 </span>
                 {diffBadge}
               </div>
               <h2 className="text-[17px] font-bold text-gray-800 leading-relaxed">
                 {currentIndex + 1}. {currentQuestion.text}
               </h2>
            </div>

            {/* Dynamic Quiz Component Rendering */}
            <div className="py-4">
               {currentQuestion.type === 'SINGLE_CHOICE' && (
                 <SingleChoiceQuiz 
                   question={currentQuestion}
                   selectedId={(userAnswers[currentQuestion.id] as string) || ''}
                   onSelect={handleSingleChoiceSelect}
                 />
               )}
               {currentQuestion.type === 'MULTIPLE_CHOICE' && (
                 <MultipleChoiceQuiz 
                   question={currentQuestion}
                   selectedIds={(userAnswers[currentQuestion.id] as string[]) || []}
                   onToggle={handleMultipleChoiceToggle}
                 />
               )}
               {currentQuestion.type === 'SHORT_ANSWER' && (
                 <ShortAnswerQuiz 
                   question={currentQuestion}
                   inputValue={(userAnswers[currentQuestion.id] as string) || ''}
                   onInputChange={handleShortAnswerChange}
                 />
               )}
            </div>
         </div>

         {/* Footer Controls */}
         <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <Link 
              href={`/subject/${subjectId}/lecture/${lectureId}`}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              종료하고 나가기
            </Link>
            
            <button
              onClick={isLastQuestion ? submitAll : handleNext}
              disabled={isSubmitting}
              className={`px-6 py-2 rounded text-sm font-bold text-white transition-colors flex items-center gap-2 ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="border-white border-t-transparent" />
                  제출 중...
                </>
              ) : isLastQuestion ? (
                '제출 및 결과 보기'
              ) : (
                '다음 문제'
              )}
            </button>
         </div>

      </div>

    </div>
  );
}
