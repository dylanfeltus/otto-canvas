"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import { ExportMenu } from "./export-menu";

const FRAME_WIDTH = 480;

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

  useEffect(() => {
    if (!iteration.html || iteration.isLoading) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: white; }
  body { width: ${FRAME_WIDTH}px; overflow-x: hidden; }
</style></head><body>${iteration.html}</body></html>`);
    doc.close();

    const measure = () => {
      try {
        if (!doc.body) return;
        const h = Math.max(
          doc.body.scrollHeight,
          doc.documentElement.scrollHeight,
          doc.body.offsetHeight,
          100
        );
        setContentHeight(h);
      } catch {}
    };

    // Measure multiple passes — no animation, just set height
    measure();
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 300);
    const t3 = setTimeout(measure, 800);
    const t4 = setTimeout(measure, 1500);

    let ro: ResizeObserver | null = null;
    try {
      if (doc.body) {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }
    } catch {}

    const imgs = doc.querySelectorAll("img");
    imgs.forEach((img) => img.addEventListener("load", measure));

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      ro?.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", measure));
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
      {/* Label + export — use group on a hover wrapper */}
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

      {/* Frame — fixed width, measured height, NO transitions on dimensions */}
      <div
        ref={wrapperRef}
        onClick={handleClick}
        onMouseDown={isSelectMode ? onDragStart : undefined}
        className={`relative bg-white rounded-xl shadow-md border border-gray-200/80 ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40"
            : isSelectMode
            ? isDragging ? "cursor-grabbing shadow-xl ring-2 ring-blue-400/30" : "cursor-grab"
            : ""
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{
          width: FRAME_WIDTH,
          height: frameHeight,
          overflow: "visible",
        }}
      >
        {iteration.isLoading ? (
          <LoadingSkeleton />
        ) : (
          <iframe
            ref={iframeRef}
            title={iteration.label}
            sandbox="allow-same-origin"
            className="border-0 pointer-events-none rounded-xl"
            style={{ width: FRAME_WIDTH, height: frameHeight, display: "block" }}
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

function LoadingSkeleton() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
      <div className="w-full space-y-3">
        <div className="shimmer h-5 rounded-lg w-2/3" />
        <div className="shimmer h-3.5 rounded-lg w-full" style={{ animationDelay: "0.1s" }} />
        <div className="shimmer h-3.5 rounded-lg w-5/6" style={{ animationDelay: "0.2s" }} />
        <div className="shimmer h-24 rounded-xl w-full mt-2" style={{ animationDelay: "0.15s" }} />
        <div className="shimmer h-3.5 rounded-lg w-4/6" style={{ animationDelay: "0.25s" }} />
        <div className="shimmer h-3.5 rounded-lg w-3/6" style={{ animationDelay: "0.3s" }} />
      </div>
      <span className="text-[11px] font-medium text-gray-400 mt-2">Generating...</span>
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
