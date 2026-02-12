"use client";

import { useState, useRef, useEffect } from "react";

interface CommentInputProps {
  position: { screenX: number; screenY: number };
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function CommentInput({ position, onSubmit, onCancel }: CommentInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clamp position so it doesn't overflow viewport
  const clampedX = Math.min(position.screenX + 16, window.innerWidth - 300);
  const clampedY = Math.min(position.screenY - 8, window.innerHeight - 200);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[60]"
      style={{
        left: clampedX,
        top: Math.max(8, clampedY),
      }}
    >
      <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_8px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] p-3 w-[272px]">
        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
          Revision comment
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Describe your revision..."
          className="w-full text-[13px] text-gray-800 placeholder-gray-400/60 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2.5 outline-none resize-none border border-white/40 focus:border-blue-300/60 focus:bg-white/80 transition-all"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2.5 px-0.5">
          <button
            onClick={onCancel}
            className="text-[12px] text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-black/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="text-[12px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 disabled:opacity-30 px-4 py-1.5 rounded-xl transition-all shadow-sm backdrop-blur-sm"
          >
            Revise ↵
          </button>
        </div>
      </div>
    </div>
  );
}
