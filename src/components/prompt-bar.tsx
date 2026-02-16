"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type { CanvasImage } from "@/lib/types";

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
  onSubmit: (prompt: string, imageIds?: string[]) => void;
  isGenerating: boolean;
  genStatus?: string;
  onCancel?: () => void;
  canvasImages: CanvasImage[];
}

export function PromptBar({ onSubmit, isGenerating, genStatus, onCancel, canvasImages }: PromptBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [showImagePicker, setShowImagePicker] = useState(false);
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

  // Clean up selected images that were removed from canvas
  useEffect(() => {
    const ids = new Set(canvasImages.map((i) => i.id));
    setSelectedImageIds((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [canvasImages]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;

    const newHistory = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);

    onSubmit(trimmed, selectedImageIds.size > 0 ? [...selectedImageIds] : undefined);
    setValue("");
    setHistoryIndex(-1);
    setDraft("");
    setSelectedImageIds(new Set());
    setShowImagePicker(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [value, isGenerating, history, onSubmit, selectedImageIds]);

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

  const toggleImage = useCallback((id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedImages = canvasImages.filter((img) => selectedImageIds.has(img.id));

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      {/* Image picker dropdown */}
      {showImagePicker && canvasImages.length > 0 && (
        <div className="pointer-events-auto mb-2 p-3 rounded-2xl bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.06)] w-[600px] max-w-[90vw]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reference Images</span>
            <button onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 flex-wrap max-h-[200px] overflow-y-auto">
            {canvasImages.map((img) => (
              <button
                key={img.id}
                onClick={() => toggleImage(img.id)}
                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  selectedImageIds.has(img.id)
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-white/30 hover:border-white/60"
                }`}
              >
                <img src={img.thumbnail} alt={img.name} className="w-full h-full object-cover" />
                {selectedImageIds.has(img.id) && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div data-tour="prompt-bar" className="pointer-events-auto flex flex-col rounded-[20px] w-[600px] max-w-[90vw] transition-all duration-300 bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.15)] focus-within:shadow-[0_12px_48px_rgba(59,130,246,0.1),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.3)] focus-within:bg-white/30 focus-within:border-white/50">
        {/* Selected image thumbnails */}
        {selectedImages.length > 0 && (
          <div className="flex gap-1.5 px-4 pt-3 pb-0 flex-wrap">
            {selectedImages.map((img) => (
              <div key={img.id} className="relative group">
                <img src={img.thumbnail} alt={img.name} className="w-10 h-10 rounded-lg object-cover border border-white/30" />
                <button
                  onClick={() => toggleImage(img.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-800/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center px-4 py-4">
          {/* Image attach button */}
          {canvasImages.length > 0 && !isGenerating && (
            <button
              onClick={() => setShowImagePicker((p) => !p)}
              className={`flex items-center justify-center w-8 h-8 mr-2 rounded-lg transition-all shrink-0 ${
                selectedImageIds.size > 0
                  ? "bg-blue-500/20 text-blue-600"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
              }`}
              title="Attach reference images"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {selectedImageIds.size > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {selectedImageIds.size}
                </span>
              )}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setHistoryIndex(-1); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={canvasImages.length > 0 ? "Describe a design... (attach images for context)" : "Describe a design..."}
            rows={1}
            className="flex-1 px-0 py-2 text-[15px] text-gray-800 placeholder-gray-400/70 bg-transparent outline-none resize-none leading-[22px]"
            style={{ maxHeight: 22 * 6 }}
          />
          {isGenerating ? (
            <div className="flex items-center gap-2 ml-2 shrink-0">
              {genStatus && (
                <span className="text-[11px] text-gray-400 font-medium animate-pulse">{genStatus}</span>
              )}
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600 transition-all shrink-0"
              title="Cancel generation (Esc)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            </div>
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
    </div>
  );
}
