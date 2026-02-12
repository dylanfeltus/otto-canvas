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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed z-[60] animate-in fade-in slide-in-from-top-1 duration-150"
      style={{
        left: position.screenX + 16,
        top: position.screenY - 8,
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-[280px]">
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
          className="w-full text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-lg px-3 py-2 outline-none resize-none focus:bg-white focus:ring-1 focus:ring-blue-300 transition-colors"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );
}
