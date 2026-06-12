import React from 'react';
import { Question } from '../../types/quiz';

interface ShortAnswerQuizProps {
  question: Question;
  inputValue: string;
  onInputChange: (text: string) => void;
}

export function ShortAnswerQuiz({ inputValue = '', onInputChange }: ShortAnswerQuizProps) {
  return (
    <div className="w-full">
      <textarea
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="정답을 입력해 주세요."
        className="w-full min-h-[120px] p-4 text-sm text-gray-800 bg-white border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
      />
      <p className="mt-3 text-xs text-gray-500">
        * 단답형 혹은 간략한 서술형으로 작성해 주세요.
      </p>
    </div>
  );
}
