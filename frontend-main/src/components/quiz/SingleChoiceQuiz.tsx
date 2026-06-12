import React from 'react';
import { Question } from '../../types/quiz';

interface SingleChoiceQuizProps {
  question: Question;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SingleChoiceQuiz({ question, selectedId, onSelect }: SingleChoiceQuizProps) {
  if (!question.options) return null;

  return (
    <div className="w-full">
      <div className="space-y-3">
        {question.options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          return (
            <label 
              key={opt.id || idx} 
              className={`flex items-center gap-3 p-4 border rounded cursor-pointer transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
            >
              <input 
                type="radio" 
                name={`question-${question.id}`} 
                value={opt.id} 
                checked={isSelected}
                onChange={() => onSelect(opt.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                {opt.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
