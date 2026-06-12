import React from 'react';
import { Question } from '../../types/quiz';

interface MultipleChoiceQuizProps {
  question: Question;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function MultipleChoiceQuiz({ question, selectedIds = [], onToggle }: MultipleChoiceQuizProps) {
  if (!question.options) return null;

  return (
    <div className="w-full">
      <div className="space-y-3">
        {question.options.map((opt, idx) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <label 
              key={opt.id || idx} 
              className={`flex items-center gap-3 p-4 border rounded cursor-pointer transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
            >
              <input 
                type="checkbox" 
                checked={isSelected}
                onChange={() => onToggle(opt.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                {opt.text}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        * 해당하는 정답을 모두 선택해 주세요.
      </p>
    </div>
  );
}
