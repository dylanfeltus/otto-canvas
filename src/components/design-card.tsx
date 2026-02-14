"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import type { PipelineStatus } from "@/lib/pipeline";
import { STAGE_CONFIG } from "@/lib/pipeline";
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
  onSelect?: (e?: React.MouseEvent) => void;
  onAddComment: (iterationId: string, position: Point) => void;
  onClickComment: (comment: CommentType) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onRemix: (iteration: DesignIteration, remixPrompt: string) => void;
  scale: number;
  apiKey?: string;
  model?: string;
  pipelineStatus?: PipelineStatus;
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
  pipelineStatus,
}: DesignCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(320);
  const measuredRef = useRef(false);

  // Build srcdoc — wrap content in a measuring div to get exact height
  const frameW = iteration.width || FRAME_WIDTH;
  const srcdoc = iteration.html && !iteration.isLoading
    ? `<!DOCTYPE html>
<html style="height:auto;overflow:hidden;"><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: hidden; }
  body { background: white; width: ${frameW}px; }
  #otto-measure { width: ${frameW}px; overflow: hidden; }
  img, video, svg { max-width: 100%; height: auto; display: block; object-fit: cover; }
  * { animation: none !important; transition: none !important; }
  /* Kill common viewport-height patterns that inflate measurement */
  [style*="100vh"], [style*="min-height: 100vh"], [style*="height: 100vh"] { height: auto !important; min-height: 0 !important; }
</style></head><body><div id="otto-measure">${iteration.html}</div>
<script>
function reportHeight() {
  var el = document.getElementById('otto-measure');
  if (!el) return;
  var h = el.offsetHeight || el.scrollHeight || 100;
  parent.postMessage({ type: 'otto-frame-height', id: '${iteration.id}', height: h }, '*');
}
reportHeight();
setTimeout(reportHeight, 50);
setTimeout(reportHeight, 200);
setTimeout(reportHeight, 600);
setTimeout(reportHeight, 1500);
</script></body></html>`
    : undefined;

  // Listen for height messages from sandboxed iframe
  useEffect(() => {
    if (!iteration.html || iteration.isLoading) return;
    measuredRef.current = false;

    // If we have a size hint from the model, use it as the initial content height
    if (iteration.height) {
      setContentHeight(iteration.height);
    }

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'otto-frame-height' && e.data.id === iteration.id) {
        const h = Math.min(Math.max(e.data.height, 50), 12000);
        setContentHeight(h);
        measuredRef.current = true;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iteration.html, iteration.isLoading, iteration.id, iteration.height]);

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
  // Use measured height if available, then size hint, then default
  const frameHeight = iteration.isLoading ? 320 : contentHeight;

  return (
    <div
      className={`absolute ${isDragging ? "z-50" : ""}`}
      data-tour="design-frame"
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
        onClick={(e) => { handleClick(e); if (isSelectMode && onSelect) { e.stopPropagation(); onSelect(e); } }}
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
        }`}
        style={{ width: iteration.width || FRAME_WIDTH, height: frameHeight }}
      >
        {/* Revision overlay */}
        {iteration.isRegenerating && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 rounded-xl">
            <svg className="w-8 h-8 animate-spin" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="3" />
              <circle cx="20" cy="20" r="16" stroke="url(#spinner-gradient-rev)" strokeWidth="3" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
              <defs>
                <linearGradient id="spinner-gradient-rev" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-[12px] font-medium text-gray-500">
              {pipelineStatus && pipelineStatus.stage !== "done" && pipelineStatus.stage !== "error"
                ? STAGE_CONFIG[pipelineStatus.stage].label
                : "Revising..."}
            </span>
          </div>
        )}

        {iteration.isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 animate-spin" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" stroke="url(#spinner-gradient)" strokeWidth="3" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
                <defs>
                  <linearGradient id="spinner-gradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="text-[12px] font-medium text-gray-400">
              {pipelineStatus && pipelineStatus.stage !== "done" && pipelineStatus.stage !== "error"
                ? STAGE_CONFIG[pipelineStatus.stage].label
                : "Generating..."}
            </span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={iteration.label}
            sandbox="allow-scripts"
            srcDoc={srcdoc}
            style={{
              width: iteration.width || FRAME_WIDTH,
              height: measuredRef.current ? contentHeight : INITIAL_IFRAME_HEIGHT,
              border: "none",
              display: "block",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Comment pins — only visible in comment mode */}
        {isCommentMode && iteration.comments.map((comment) => (
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
        data-tour="remix-button"
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

const STATUS_COLORS = {
  waiting: { bg: "bg-gray-400", shadow: "rgba(156,163,175,0.4)", anchor: "bg-gray-400/60", ping: "bg-gray-400/30" },
  working: { bg: "bg-amber-500", shadow: "rgba(245,158,11,0.4)", anchor: "bg-amber-400/60", ping: "bg-amber-400/30" },
  done:    { bg: "bg-emerald-500", shadow: "rgba(16,185,129,0.4)", anchor: "bg-emerald-400/60", ping: "bg-emerald-400/30" },
} as const;

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

  const status = comment.status || "waiting";
  const colors = STATUS_COLORS[status];
  const isWorking = status === "working";

  return (
    <div
      className="absolute z-20"
      style={{
        left: comment.position.x - 14,
        top: comment.position.y - 14,
      }}
    >
      {(isNew || isWorking) && (
        <span className={`absolute inset-0 rounded-full ${colors.ping} animate-ping`} />
      )}
      <span className={`absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-2 ${colors.anchor}`} />
      <button
        className={`relative w-7 h-7 rounded-full ${colors.bg} text-white text-[11px] font-bold flex items-center justify-center hover:scale-110 transition-all cursor-pointer border-2 border-white`}
        style={{ boxShadow: `0 2px 8px ${colors.shadow}` }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={comment.aiResponse || comment.text}
      >
        {status === "done" ? "✓" : comment.number}
      </button>
    </div>
  );
}
