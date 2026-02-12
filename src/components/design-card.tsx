"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import { ExportMenu } from "./export-menu";

const FRAME_WIDTH = 480;
const INITIAL_IFRAME_HEIGHT = 2000; // Start tall, measure down

interface DesignCardProps {
  iteration: DesignIteration;
  isCommentMode: boolean;
  isSelectMode: boolean;
  isDragging: boolean;
  onAddComment: (iterationId: string, position: Point) => void;
  onClickComment: (comment: CommentType) => void;
  onDragStart: (e: React.MouseEvent) => void;
  scale: number;
  apiKey?: string;
  model?: string;
}

export function DesignCard({
  iteration,
  isCommentMode,
  isSelectMode,
  isDragging,
  onAddComment,
  onClickComment,
  onDragStart,
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
  html { height: auto; }
  body { margin: 0; padding: 0; background: white; width: ${FRAME_WIDTH}px; overflow-x: hidden; overflow-y: hidden; min-height: 100px; }
</style></head><body>${iteration.html}</body></html>`);
    doc.close();

    const measure = () => {
      try {
        const d = iframe.contentDocument;
        if (!d?.documentElement) return;
        // Read the true content height
        const h = Math.max(
          d.documentElement.scrollHeight,
          d.body?.scrollHeight ?? 0,
          d.body?.offsetHeight ?? 0,
          100
        );
        setContentHeight(h + 20); // 20px buffer
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

  const frameHeight = iteration.isLoading ? 320 : contentHeight;

  return (
    <div
      className={`absolute ${isDragging ? "z-50" : ""}`}
      style={{
        left: iteration.position.x,
        top: iteration.position.y,
        width: FRAME_WIDTH,
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
          <div className="ml-auto opacity-0 group-hover/label:opacity-100 transition-opacity">
            <ExportMenu html={iteration.html} label={iteration.label} apiKey={apiKey} model={model} />
          </div>
        )}
      </div>

      {/* Frame — fixed width, NO transitions on any dimension */}
      <div
        ref={wrapperRef}
        onClick={handleClick}
        onMouseDown={isSelectMode ? onDragStart : undefined}
        className={`relative bg-white rounded-xl shadow-md border border-gray-200/80 overflow-hidden ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40"
            : isSelectMode
            ? isDragging ? "cursor-grabbing shadow-xl ring-2 ring-blue-400/30" : "cursor-grab"
            : ""
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{ width: FRAME_WIDTH, height: frameHeight }}
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
              width: FRAME_WIDTH,
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
