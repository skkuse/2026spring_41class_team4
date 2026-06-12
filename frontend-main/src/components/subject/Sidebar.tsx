import React from 'react';
import { Lecture } from '../../types/subject';

interface SidebarProps {
  lectures: Lecture[];
  onAddMaterial: () => void;
  onSelectLecture: (lectureId: string) => void;
}

export function Sidebar({ lectures, onAddMaterial, onSelectLecture }: SidebarProps) {
  return (
    <aside className="w-[280px] flex-none border-r border-gray-200 bg-white flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h5 className="text-sm font-bold text-gray-500 uppercase mb-3 px-2">강의 목록</h5>
        {lectures.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded bg-gray-50">
            등록된 강의가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lecture) => (
              <button
                key={lecture.id}
                onClick={() => onSelectLecture(lecture.id)}
                className="block w-full py-3 px-4 bg-white border border-gray-200 rounded text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors font-medium text-sm text-left"
              >
                {lecture.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onAddMaterial}
          className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-600 rounded flex flex-col items-center justify-center hover:border-blue-500 hover:text-blue-600 bg-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-1"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <span className="text-sm font-medium">강의자료 추가</span>
        </button>
      </div>
    </aside>
  );
}
