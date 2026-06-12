import React from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-10 h-10 border-4",
    xl: "w-12 h-12 border-4",
  };

  return (
    <div 
      className={`rounded-full border-gray-200 border-t-blue-600 animate-spin ${sizeClasses[size]} ${className}`} 
      role="status" 
      aria-label="Loading"
    />
  );
}
