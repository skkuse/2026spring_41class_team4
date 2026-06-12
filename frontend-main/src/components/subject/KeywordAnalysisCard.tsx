import React from 'react';
import { Keyword } from '../../types/subject';

interface KeywordAnalysisCardProps {
  strongKeywords: Keyword[];
  weakKeywords: Keyword[];
}

export function KeywordAnalysisCard({ strongKeywords, weakKeywords }: KeywordAnalysisCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-4">학습 키워드 분석</h3>
      
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-500 mb-2">강한 키워드</h4>
        {strongKeywords.length === 0 ? (
          <p className="text-xs text-gray-400">분석된 강한 키워드가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {strongKeywords.map((kw, i) => (
              <span key={`strong-${i}`} className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-500 mb-2">약한 키워드</h4>
        {weakKeywords.length === 0 ? (
          <p className="text-xs text-gray-400">분석된 약한 키워드가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {weakKeywords.map((kw, i) => (
              <span key={`weak-${i}`} className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
