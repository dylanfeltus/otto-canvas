"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const HISTORY_KEY = "otto-prompt-history";
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {}
}

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  genStatus?: string;
  onCancel?: () => void;
  imageCount?: number;
}

export function PromptBar({ onSubmit, isGenerating, genStatus, onCancel, imageCount = 0 }: PromptBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * 6;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;

    const newHistory = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);

    onSubmit(trimmed);
    setValue("");
    setHistoryIndex(-1);
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [value, isGenerating, history, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === "Escape" && isGenerating) {
      onCancel?.();
      return;
    }

    const input = inputRef.current;
    if (!input) return;

    if (e.key === "ArrowUp" && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) return;
      if (historyIndex === -1) setDraft(value);
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
    }

    if (e.key === "ArrowDown" && input.selectionStart === value.length && input.selectionEnd === value.length) {
      e.preventDefault();
      if (historyIndex <= -1) return;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (newIndex === -1) setValue(draft);
      else setValue(history[newIndex]);
    }
  }, [handleSubmit, isGenerating, onCancel, history, historyIndex, value, draft]);

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        data-tour="prompt-bar"
        className={`pointer-events-auto flex items-center rounded-[20px] px-4 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.15)] ${
          isGenerating
            ? "w-[280px] py-2.5 px-3"
            : "w-[600px] max-w-[90vw] py-4 focus-within:shadow-[0_12px_48px_rgba(59,130,246,0.1),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.3)] focus-within:bg-white/30 focus-within:border-white/50"
        }`}
      >
        {isGenerating ? (
          /* Compact status bar */
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 animate-spin shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="text-[13px] text-gray-500 font-medium truncate">
                {genStatus || "Generating..."}
              </span>
            </div>
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600 transition-all shrink-0"
              title="Cancel (Esc)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          /* Full input bar */
          <>
            {/* Image context indicator */}
            {imageCount > 0 && (
              <div className="flex items-center gap-1 mr-2 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 shrink-0" title={`${imageCount} reference image${imageCount !== 1 ? "s" : ""} will be included`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-[11px] font-medium">{imageCount}</span>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); setHistoryIndex(-1); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder="Describe a design..."
              rows={1}
              className="flex-1 px-0 py-2 text-[15px] text-gray-800 placeholder-gray-400/70 bg-transparent outline-none resize-none leading-[22px]"
              style={{ maxHeight: 22 * 6 }}
            />
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
          </>
        )}
      </div>
    </div>
  );
}
