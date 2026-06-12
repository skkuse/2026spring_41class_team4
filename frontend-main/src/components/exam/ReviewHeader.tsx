import React from 'react';
import Link from 'next/link';

interface ReviewHeaderProps {
  finalScore: number;
  subjectTitle: string;
  subjectId: string;
  returnUrl?: string | null;
}

export function ReviewHeader({ finalScore, subjectTitle, subjectId, returnUrl }: ReviewHeaderProps) {
  const backHref = returnUrl || `/subject/${subjectId}`;
  
  return (
    <header className="flex-none px-4 md:px-8 py-3 border-b border-gray-200 bg-white z-20">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
         <div className="flex items-center gap-3">
           <Link href={backHref} className="text-gray-500 hover:text-gray-700 transition-colors p-1 bg-gray-50 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
           </Link>
           <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {subjectTitle}
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] rounded font-bold uppercase">풀이 기록</span>
           </h1>
         </div>
         
         <div className="text-sm font-bold text-gray-600">
           최종 점수: <span className="text-blue-600 text-xl ml-1">{finalScore}</span>점
         </div>
      </div>
    </header>
  );
}
