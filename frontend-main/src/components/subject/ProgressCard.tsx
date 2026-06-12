import React from 'react';

interface ProgressCardProps {
  mastery: number;
  coverage: number;
}

export const CircularProgress = ({ 
  title, 
  percentage, 
  colorClass 
}: { 
  title: string; 
  percentage: number; 
  colorClass: string; 
}) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-gray-600 font-bold uppercase text-sm">{title}</span>
      <div className="relative flex items-center justify-center w-[100px] h-[100px]">
        {/* SVG Chart */}
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle track */}
          <circle
            cx="50" cy="50" r={radius}
            stroke="currentColor" strokeWidth="8" fill="transparent"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx="50" cy="50" r={radius}
            stroke="currentColor" strokeWidth="8" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-1000 ease-out ${colorClass}`}
            strokeLinecap="round"
          />
        </svg>
        {/* Percentage Text */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-800">
            {percentage}<span className="text-sm font-normal text-gray-500 ml-0.5">%</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export function ProgressCard({ mastery, coverage }: ProgressCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-6">학습 진행도</h3>
      <div className="flex justify-around items-center">
        <CircularProgress title="Mastery" percentage={mastery} colorClass="text-blue-600" />
        <CircularProgress title="Coverage" percentage={coverage} colorClass="text-green-600" />
      </div>
    </div>
  );
}
