"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";

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
  onCancel?: () => void;
}

export function PromptBar({ onSubmit, isGenerating, onCancel }: PromptBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = current input, 0 = most recent, etc.
  const [draft, setDraft] = useState(""); // saves current input when browsing history
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * 6; // cap at 6 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;

    // Add to history (avoid duplicates at the top)
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

    // Up arrow at start of input → browse history backwards
    if (e.key === "ArrowUp" && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      if (history.length === 0) return;

      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) return;

      // Save current input as draft when first entering history
      if (historyIndex === -1) {
        setDraft(value);
      }

      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
    }

    // Down arrow at end of input → browse history forwards
    if (e.key === "ArrowDown" && input.selectionStart === value.length && input.selectionEnd === value.length) {
      e.preventDefault();
      if (historyIndex <= -1) return;

      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);

      if (newIndex === -1) {
        setValue(draft);
      } else {
        setValue(history[newIndex]);
      }
    }
  }, [handleSubmit, isGenerating, onCancel, history, historyIndex, value, draft]);

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center rounded-[20px] px-4 py-4 w-[600px] max-w-[90vw] transition-all duration-300 bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.15)] focus-within:shadow-[0_12px_48px_rgba(59,130,246,0.1),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.3)] focus-within:bg-white/30 focus-within:border-white/50">
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
