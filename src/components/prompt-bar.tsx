"use client";

import { useState, useRef } from "react";

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
}

export function PromptBar({ onSubmit, isGenerating }: PromptBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center bg-white rounded-full shadow-2xl border border-gray-200 px-2 py-1.5 w-[560px] max-w-[90vw] transition-shadow focus-within:shadow-blue-200/50 focus-within:border-blue-300">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Describe a design..."
          disabled={isGenerating}
          className="flex-1 px-4 py-2.5 text-[15px] text-gray-800 placeholder-gray-400 bg-transparent outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isGenerating}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-900 transition-colors shrink-0"
        >
          {isGenerating ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
