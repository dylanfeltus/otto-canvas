"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import { ExportMenu } from "./export-menu";

export const DEFAULT_FRAME_WIDTH = 480;
const FRAME_WIDTH = DEFAULT_FRAME_WIDTH; // kept for export compat
const INITIAL_IFRAME_HEIGHT = 2000; // Start tall, measure down

interface DesignCardProps {
  iteration: DesignIteration;
  isCommentMode: boolean;
  isSelectMode: boolean;
  isDragging: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onAddComment: (iterationId: string, position: Point) => void;
  onClickComment: (comment: CommentType) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onRemix: (iteration: DesignIteration, remixPrompt: string) => void;
  scale: number;
  apiKey?: string;
  model?: string;
}

const REMIX_PRESETS = [
  { label: "🎨 Different colors", prompt: "Same layout and content, but try 4 completely different color palettes" },
  { label: "📐 Different layouts", prompt: "Same content and message, but try 4 completely different layouts and compositions" },
  { label: "🔤 Different typography", prompt: "Same layout and colors, but try 4 different typography styles and font pairings" },
  { label: "✨ More minimal", prompt: "Same concept but much more minimal — fewer elements, more whitespace, simpler" },
  { label: "🔥 More bold", prompt: "Same concept but much bolder — bigger type, stronger colors, more visual impact" },
];

export function DesignCard({
  iteration,
  isCommentMode,
  isSelectMode,
  isDragging,
  isSelected,
  onSelect,
  onAddComment,
  onClickComment,
  onDragStart,
  onRemix,
  scale,
  apiKey,
  model,
}: DesignCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(320);
  const measuredRef = useRef(false);

  useEffect(() => {
    if (!iteration.html || iteration.isLoading) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    measuredRef.current = false;

    // Write content with a tall body so nothing clips during measurement
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html { height: auto; max-height: none; }
  body { margin: 0; padding: 0; background: white; width: ${iteration.width || FRAME_WIDTH}px; overflow: hidden; min-height: 100px; max-height: none; }
  body > * { max-height: 2000px; }
</style></head><body>${iteration.html}</body></html>`);
    doc.close();

    const measure = () => {
      try {
        const d = iframe.contentDocument;
        if (!d?.documentElement) return;

        // Prefer first child element height (avoids viewport unit inflation)
        const firstChild = d.body?.firstElementChild as HTMLElement | null;
        const childH = firstChild ? firstChild.offsetHeight : 0;
        const scrollH = Math.max(
          d.documentElement.scrollHeight,
          d.body?.scrollHeight ?? 0,
          d.body?.offsetHeight ?? 0,
        );

        // Use the smaller of scrollHeight and firstChild height (if reasonable)
        // This avoids 100vh expanding to the 2000px initial iframe height
        let h = scrollH;
        if (childH > 100 && childH < scrollH) {
          h = childH;
        }

        // Cap to model hint + generous buffer, or absolute max
        const hintMax = (iteration.height || 900) * 1.5;
        h = Math.min(Math.max(h, 100), hintMax, 1500);

        setContentHeight(h);
        measuredRef.current = true;
      } catch {}
    };

    // iframe load event
    const onLoad = () => measure();
    iframe.addEventListener("load", onLoad);

    // Also measure on multiple delays to catch fonts/images
    measure();
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    const t3 = setTimeout(measure, 1000);
    const t4 = setTimeout(measure, 2000);

    return () => {
      iframe.removeEventListener("load", onLoad);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [iteration.html, iteration.isLoading]);

  const handleClick = (e: React.MouseEvent) => {
    if (!isCommentMode) return;
    e.stopPropagation();

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    onAddComment(iteration.id, { x, y });
  };

  // Use measured content height, fallback to model hint
  const measuredHeight = measuredRef.current ? contentHeight : (iteration.height || 320);
  const frameHeight = iteration.isLoading ? 320 : measuredHeight;

  return (
    <div
      className={`absolute ${isDragging ? "z-50" : ""}`}
      style={{
        left: iteration.position.x,
        top: iteration.position.y,
        width: iteration.width || FRAME_WIDTH,
      }}
    >
      {/* Label + export */}
      <div className="mb-2 flex items-center gap-2 group/label">
        <span className="text-xs font-medium text-gray-500/80 bg-white/60 backdrop-blur-sm px-2.5 py-0.5 rounded-lg border border-white/40">
          {iteration.label}
        </span>
        {iteration.isRegenerating && (
          <span className="text-xs text-blue-500 font-medium animate-pulse flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
            </svg>
            Revising...
          </span>
        )}
        {!iteration.isLoading && iteration.html && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/label:opacity-100 transition-opacity">
            <RemixButton iteration={iteration} onRemix={onRemix} />
            <ExportMenu html={iteration.html} label={iteration.label} width={iteration.width} apiKey={apiKey} model={model} />
          </div>
        )}
      </div>

      {/* Frame — fixed width, NO transitions on any dimension */}
      <div
        ref={wrapperRef}
        onClick={(e) => { handleClick(e); if (isSelectMode && onSelect) { e.stopPropagation(); onSelect(); } }}
        onMouseDown={(e) => { if (isSelectMode) { e.stopPropagation(); onDragStart(e); } }}
        className={`relative bg-white rounded-xl shadow-md border overflow-hidden transition-shadow ${
          isSelected
            ? "ring-2 ring-blue-500 border-blue-400/50 shadow-lg"
            : "border-gray-200/80"
        } ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40"
            : isSelectMode
            ? isDragging ? "cursor-grabbing shadow-xl ring-2 ring-blue-400/30" : "cursor-grab hover:shadow-lg"
            : ""
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{ width: iteration.width || FRAME_WIDTH, height: frameHeight }}
      >
        {iteration.isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="loading-spinner" />
            <span className="text-[12px] font-medium text-gray-400">Generating...</span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={iteration.label}
            sandbox="allow-same-origin"
            style={{
              width: iteration.width || FRAME_WIDTH,
              height: measuredRef.current ? contentHeight : INITIAL_IFRAME_HEIGHT,
              border: "none",
              display: "block",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Comment pins */}
        {iteration.comments.map((comment) => (
          <CommentPin
            key={comment.id}
            comment={comment}
            onClick={() => onClickComment(comment)}
          />
        ))}
      </div>
    </div>
  );
}

export { FRAME_WIDTH };

function RemixButton({ iteration, onRemix }: { iteration: DesignIteration; onRemix: (iteration: DesignIteration, prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRemix = (prompt: string) => {
    setOpen(false);
    setCustomPrompt("");
    onRemix(iteration, prompt);
  };

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all"
        title="Remix this design"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        Remix
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white/70 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] p-1.5 min-w-[260px] z-30">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Quick remix</div>
          {REMIX_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleRemix(preset.prompt)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-gray-700 hover:bg-black/5 transition-colors text-left"
            >
              {preset.label}
            </button>
          ))}
          <div className="my-1.5 border-t border-gray-200/30" />
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Custom</div>
          <div className="flex gap-1.5 px-1.5 pb-1">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && customPrompt.trim()) handleRemix(customPrompt.trim()); }}
              placeholder="Try it with..."
              className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-black/5 outline-none placeholder-gray-400"
            />
            <button
              onClick={() => customPrompt.trim() && handleRemix(customPrompt.trim())}
              disabled={!customPrompt.trim()}
              className="px-3 py-2 rounded-lg text-[12px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 disabled:opacity-40 transition-all"
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentPin({
  comment,
  onClick,
}: {
  comment: CommentType;
  onClick: () => void;
}) {
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute z-20"
      style={{
        left: comment.position.x - 14,
        top: comment.position.y - 14,
      }}
    >
      {isNew && (
        <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
      )}
      <span className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-2 bg-blue-400/60" />
      <button
        className="relative w-7 h-7 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center shadow-[0_2px_8px_rgba(59,130,246,0.4)] hover:bg-blue-600 hover:scale-110 transition-all cursor-pointer border-2 border-white"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={comment.text}
      >
        {comment.number}
      </button>
    </div>
  );
}
