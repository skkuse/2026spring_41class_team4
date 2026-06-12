"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { quizService } from '../../../services/quizService';
import { quizAttemptService } from '../../../services/quizAttemptService';
import { QuizDetails } from '../../../types/quiz';
import { SubmitAnswerDto } from '../../../types/quizAttempt';
import { useToast } from '../../../contexts/ToastContext';
import { Spinner } from '../../../components/ui/Spinner';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;
  const { showToast } = useToast();

  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  
  const [step, setStep] = useState<'loading' | 'intro' | 'quiz' | 'submitting'>('loading');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({}); // key: questionId, value: string | string[]

  useEffect(() => {
    if (quizId) {
      quizService.getQuizDetails(quizId).then(data => {
        setQuizDetails(data);
        setStep('intro');
      }).catch(err => {
        console.error(err);
      });
    }
  }, [quizId]);

  const handleStartQuiz = async () => {
    try {
      setStep('loading');
      const res = await quizAttemptService.startAttempt(quizId);
      setAttemptId(res.attemptId);
      setStep('quiz');
    } catch (err) {
      console.error(err);
      setStep('intro');
      showToast('퀴즈를 시작할 수 없습니다.', 'error');
    }
  };

  const handleSelectSingle = (qId: string, optionId: string) => {
    setAnswers({ ...answers, [qId]: optionId });
  };

  const handleSelectMultiple = (qId: string, optionId: string) => {
    const current = (answers[qId] as string[]) || [];
    if (current.includes(optionId)) {
      setAnswers({ ...answers, [qId]: current.filter(o => o !== optionId) });
    } else {
      setAnswers({ ...answers, [qId]: [...current, optionId] });
    }
  };

  const handleShortAnswer = (qId: string, text: string) => {
    setAnswers({ ...answers, [qId]: text });
  };

  const handleNextOrSubmit = async () => {
    if (!quizDetails || !attemptId) return;
    const question = quizDetails.questions[currentQuestionIndex];
    const answer = answers[question.id];

    setStep('submitting');
    try {
      const dto: SubmitAnswerDto = {
        quizProblemId: question.id,
        usedHint: false,
        elapsedSeconds: 0,
      };

      if (question.type === 'MULTIPLE_CHOICE') {
        dto.selectedChoiceIds = answer as string[];
      } else {
        dto.userAnswer = answer as string;
      }

      await quizAttemptService.submitAnswer(attemptId, dto);

      if (currentQuestionIndex < quizDetails.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setStep('quiz');
      } else {
        await quizAttemptService.submitAttempt(attemptId);
        router.push(`/exam/${attemptId}/review`);
      }
    } catch (err) {
      console.error(err);
      setStep('quiz');
      showToast('답안 제출 중 오류가 발생했습니다.', 'error');
    }
  };

  if (step === 'loading' || !quizDetails) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <Spinner size="lg" className="border-gray-200" />
        <p className="mt-4 text-sm font-bold text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white border border-gray-200 shadow-sm rounded p-8 text-center">
           <h1 className="text-2xl font-bold text-gray-800 mb-4">
             {quizDetails.title}
           </h1>
           <p className="text-gray-600 mb-8">
             지금까지 학습한 내용을 점검하는 테스트입니다.<br/>
             총 {quizDetails.questions.length}문제가 출제됩니다.
           </p>

           <div className="flex items-center justify-center gap-3">
              <Link href={`/`} className="px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium">
                취소 및 돌아가기
              </Link>
              <button 
                onClick={handleStartQuiz}
                className="px-6 py-2 rounded font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                퀴즈 시작하기
              </button>
           </div>
        </div>
      </div>
    );
  }

  const question = quizDetails.questions[currentQuestionIndex];
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-3xl bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-600">{quizDetails.title}</h1>
          <span className="text-sm font-bold text-gray-500">{currentQuestionIndex + 1} / {quizDetails.questions.length}</span>
        </div>
        
        <div className="p-8">
           <div className="flex gap-4 mb-6">
              <span className="text-2xl font-bold text-blue-600">
                {currentQuestionIndex + 1}.
              </span>
              <div className="flex-1">
                 <h2 className="text-lg font-bold text-gray-800 mb-4">
                   {question.text}
                 </h2>
                 
                 <div className="flex gap-2 mb-6">
                    <span className="px-2 py-1 bg-gray-200 rounded text-xs font-bold text-gray-700">
                      {question.type === 'SINGLE_CHOICE' ? '단일선택 객관식' : question.type === 'MULTIPLE_CHOICE' ? '다중선택 객관식' : '단답형'}
                    </span>
                    <span className="px-2 py-1 bg-gray-200 rounded text-xs font-bold text-gray-700">
                      난이도: <span className={question.difficulty === 'HIGH' ? 'text-red-600' : question.difficulty === 'LOW' ? 'text-green-600' : 'text-blue-600'}>{question.difficulty}</span>
                    </span>
                 </div>
                 
                 <div className="space-y-3">
                   {question.type === 'SINGLE_CHOICE' && question.options?.map((opt, i) => {
                     const isSelected = answers[question.id] === opt.id;
                     return (
                       <button 
                         key={i} 
                         onClick={() => handleSelectSingle(question.id, opt.id)}
                         className={`w-full flex items-center gap-3 p-3 rounded border text-left transition-colors ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-800 font-semibold' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                       >
                          <input type="radio" checked={isSelected} readOnly className="mt-0.5" />
                          <span className="text-sm">{opt.text}</span>
                       </button>
                     )
                   })}

                   {question.type === 'MULTIPLE_CHOICE' && question.options?.map((opt, i) => {
                     const isChecked = (answers[question.id] as string[] || []).includes(opt.id);
                     return (
                       <button 
                         key={i} 
                         onClick={() => handleSelectMultiple(question.id, opt.id)}
                         className={`w-full flex items-center gap-3 p-3 rounded border text-left transition-colors ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-800 font-semibold' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                       >
                          <input type="checkbox" checked={isChecked} readOnly className="mt-0.5" />
                          <span className="text-sm">{opt.text}</span>
                       </button>
                     )
                   })}

                   {question.type === 'SHORT_ANSWER' && (
                      <textarea 
                         rows={3}
                         value={(answers[question.id] as string) || ''}
                         onChange={(e) => handleShortAnswer(question.id, e.target.value)}
                         placeholder="정답을 입력하세요"
                         className="w-full px-3 py-2 bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded text-gray-900 outline-none text-sm resize-none transition-colors"
                      />
                   )}
                 </div>
              </div>
           </div>

           <div className="border-t border-gray-200 mt-8 pt-4 flex justify-end">
              <button 
                onClick={handleNextOrSubmit} 
                disabled={!answers[question.id] || answers[question.id].length === 0 || step === 'submitting'}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 rounded font-medium transition-colors"
              >
                {step === 'submitting' ? '처리 중...' : currentQuestionIndex === quizDetails.questions.length - 1 ? '제출 및 결과 보기' : '다음 문제'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
