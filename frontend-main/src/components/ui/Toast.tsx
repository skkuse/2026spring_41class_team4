import React from "react";

export interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
}

export function Toast({ message, type = "info" }: ToastProps) {
  const typeStyles = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-gray-800 text-white",
  };

  return (
    <div
      className={`px-4 py-3 rounded shadow-lg flex items-center gap-3 transition-all animate-fade-in-up ${typeStyles[type]}`}
    >
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
