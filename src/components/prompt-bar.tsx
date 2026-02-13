"use client";

import { useState, useRef } from "react";

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  onCancel?: () => void;
}

export function PromptBar({ onSubmit, isGenerating, onCancel }: PromptBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center rounded-[20px] px-7 py-4 w-[600px] max-w-[90vw] transition-all duration-300 bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.15)] focus-within:shadow-[0_12px_48px_rgba(59,130,246,0.1),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.3)] focus-within:bg-white/30 focus-within:border-white/50">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape" && isGenerating) onCancel?.();
          }}
          placeholder="Describe a design..."
          className="flex-1 px-4 py-2 text-[15px] text-gray-800 placeholder-gray-400/70 bg-transparent outline-none"
        />
        {isGenerating ? (
          <button
            onClick={onCancel}
            className="flex items-center justify-center w-10 h-10 ml-2 rounded-xl bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600 transition-all shrink-0"
            title="Cancel generation (Esc)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex items-center justify-center w-10 h-10 ml-2 rounded-xl bg-gray-900/80 backdrop-blur-sm text-white hover:bg-gray-800 disabled:opacity-25 disabled:hover:bg-gray-900/80 transition-all shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
