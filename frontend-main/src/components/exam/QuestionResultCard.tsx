import React from 'react';
import { QuestionResult } from '../../types/exam';

interface QuestionResultCardProps {
  questionResult: QuestionResult;
  index: number;
  onClick: () => void;
  isActive: boolean;
}

export function QuestionResultCard({ questionResult, index, onClick, isActive }: QuestionResultCardProps) {
  const { question, userAnswer, isCorrect, keywords, correctAnswer, choices } = questionResult;

  return (
    <div 
      onClick={onClick}
      className={`group w-full bg-white border ${isCorrect ? 'border-green-300 border-[2px]' : 'border-red-300 border-[2px]'} ${isActive ? 'ring-2 ring-blue-400' : ''} rounded shadow-sm hover:shadow-md p-6 cursor-pointer transition-shadow flex gap-4`}
    >
      <div className="flex flex-col items-center gap-2 mt-1 flex-none w-[40px]">
        <span className="text-xl font-bold text-gray-400">{index + 1}.</span>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isCorrect ? 'border-green-500 text-green-600 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
           {isCorrect ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           )}
        </div>
      </div>

      <div className="flex-1">
        <div className="mb-4">
           <h2 className="text-[17px] font-bold text-gray-800 mb-2">{question.text}</h2>
           <div className="flex flex-wrap gap-2">
             {keywords.map((kw, i) => (
               <span key={i} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[11px] font-bold">{kw}</span>
             ))}
           </div>
        </div>

        <div className="space-y-2">
           {question.type === 'SINGLE_CHOICE' && question.options?.map((opt, i) => {
             const isUserAnswer = userAnswer === opt.id;
             const isChoiceCorrect = choices?.find(c => c.id === opt.id)?.isCorrect || false;
             
             let optClass = "bg-white border border-gray-300 text-gray-700";
             let label = "";

             if (isUserAnswer) {
               optClass = isChoiceCorrect ? "bg-green-50 border-green-500 text-green-900 font-bold shadow-sm" : "bg-red-50 border-red-500 text-red-900 font-bold shadow-sm";
               label = isChoiceCorrect ? "정답" : "오답 선택";
             } else if (isChoiceCorrect) {
               optClass = "bg-white border-green-500 text-green-700 font-bold border-dashed";
               label = "정답 (미선택)";
             }

             return (
               <div key={i} className={`w-full flex items-center justify-between p-3 rounded transition-colors ${optClass}`}>
                  <div className="flex items-center gap-3">
                     <input type="radio" readOnly checked={isUserAnswer || isChoiceCorrect} className="mt-0.5" />
                     <span className="text-sm">{opt.text}</span>
                  </div>
                  {label && <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${label.includes('정답') ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{label}</span>}
               </div>
             );
           })}

           {question.type === 'MULTIPLE_CHOICE' && question.options?.map((opt, i) => {
             const userAnsArr = (userAnswer as string[]) || [];
             const isUserAnswer = userAnsArr.includes(opt.id);
             const isChoiceCorrect = choices?.find(c => c.id === opt.id)?.isCorrect || false;
             
             let optClass = "bg-white border border-gray-300 text-gray-700";
             let label = "";

             if (isUserAnswer) {
               // To keep it simple, if user chose it and it's part of the correct choices, green, else red
               optClass = isChoiceCorrect ? "bg-green-50 border-green-500 text-green-900 font-bold shadow-sm" : "bg-red-50 border-red-500 text-red-900 font-bold shadow-sm";
               label = isChoiceCorrect ? "정답 (맞춤)" : "오답 선택";
             } else if (isChoiceCorrect) {
               optClass = "bg-white border-green-500 text-green-700 font-bold border-dashed";
               label = "정답 (미선택)";
             }

             return (
               <div key={i} className={`w-full flex items-center justify-between p-3 rounded transition-colors ${optClass}`}>
                  <div className="flex items-center gap-3">
                     <input type="checkbox" readOnly checked={isUserAnswer || isChoiceCorrect} className="mt-0.5" />
                     <span className="text-sm">{opt.text}</span>
                  </div>
                  {label && <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${label.includes('정답') ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{label}</span>}
               </div>
             );
           })}

           {question.type === 'SHORT_ANSWER' && (
              <div className="flex flex-col md:flex-row gap-3">
                 <div className="flex-1 bg-white border border-gray-300 rounded p-3">
                    <span className="block text-[11px] font-bold text-gray-500 uppercase mb-1">내가 제출한 답</span>
                    <div className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                       {(userAnswer as string) || <span className="text-gray-400 font-normal">미입력</span>} 
                    </div>
                 </div>
                 <div className="flex-1 bg-green-50 border border-green-300 rounded p-3">
                    <span className="block text-[11px] font-bold text-green-700 uppercase mb-1">실제 정답</span>
                    <div className="text-sm font-bold text-green-900">
                       {correctAnswer}
                    </div>
                 </div>
              </div>
           )}
        </div>

        <div className="mt-4 flex justify-end text-blue-600 text-[12px] font-bold items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           클릭하여 해설 보기
           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-rotate-45"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>
    </div>
  );
}
