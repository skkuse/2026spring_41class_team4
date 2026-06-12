"use client";

import React from 'react';
import Link from 'next/link';

interface SubjectCardProps {
  id: string;
  title: string;
  thumbnail: string;
  masteryScore: number;
  onDelete?: () => void;
}

export function SubjectCard({ id, title, thumbnail, masteryScore, onDelete }: SubjectCardProps) {
  return (
    <Link 
      href={`/subject/${id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded overflow-hidden hover:shadow-sm transition-shadow cursor-pointer"
    >
      {/* Image & Progress */}
      <div className="relative h-40 w-full bg-gray-200 border-b border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded shadow-sm border border-gray-200 flex flex-col items-end">
          <span className="text-[10px] text-gray-500 uppercase font-bold">숙련도</span>
          <span className="text-sm font-bold text-blue-600">
            {masteryScore}%
          </span>
        </div>
      </div>
      
      {/* Title & Delete */}
      <div className="p-3 bg-white flex-1 flex justify-between items-start">
        <h3 className="text-base font-semibold text-gray-800 line-clamp-2 pr-2">
          {title}
        </h3>
        {onDelete && (
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault(); // prevent link navigation
              if (confirm('정말로 이 과목을 삭제하시겠습니까?')) {
                onDelete();
              }
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            aria-label="과목 삭제"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}
