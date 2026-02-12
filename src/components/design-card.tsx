"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import { ExportMenu } from "./export-menu";

interface DesignCardProps {
  iteration: DesignIteration;
  isCommentMode: boolean;
  onAddComment: (iterationId: string, position: Point) => void;
  onClickComment: (comment: CommentType) => void;
  scale: number;
  apiKey?: string;
  model?: string;
}

export function DesignCard({
  iteration,
  isCommentMode,
  onAddComment,
  onClickComment,
  scale,
  apiKey,
  model,
}: DesignCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 420, height: 320 });

  const measureIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const w = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth, 200);
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 80);
      setSize({ width: Math.min(w + 2, 900), height: h + 2 });
    } catch {}
  }, []);

  useEffect(() => {
    if (!iteration.html || iteration.isLoading) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Write content into iframe
    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: white; }
  body { width: max-content; min-width: 200px; }
</style></head><body>${iteration.html}</body></html>`);
    doc.close();

    // Measure after load + multiple passes for fonts/images
    const measure = () => measureIframe();
    measure();
    setTimeout(measure, 50);
    setTimeout(measure, 200);
    setTimeout(measure, 600);
    setTimeout(measure, 1200);

    // ResizeObserver on body for dynamic content
    let ro: ResizeObserver | null = null;
    try {
      if (doc.body) {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }
    } catch {}

    // Also listen for images
    const imgs = doc.querySelectorAll("img");
    imgs.forEach((img) => img.addEventListener("load", measure));

    return () => {
      ro?.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", measure));
    };
  }, [iteration.html, iteration.isLoading, measureIframe]);

  const handleClick = (e: React.MouseEvent) => {
    if (!isCommentMode) return;
    e.stopPropagation();

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    onAddComment(iteration.id, { x, y });
  };

  return (
    <div
      className="absolute group"
      style={{
        left: iteration.position.x,
        top: iteration.position.y,
        width: size.width,
      }}
    >
      {/* Label + export */}
      <div className="mb-2 flex items-center gap-2">
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
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <ExportMenu html={iteration.html} label={iteration.label} apiKey={apiKey} model={model} />
          </div>
        )}
      </div>

      {/* Design render area */}
      <div
        ref={wrapperRef}
        onClick={handleClick}
        className={`relative bg-white rounded-xl shadow-md border border-gray-200/80 transition-all ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40 hover:shadow-lg"
            : "cursor-default hover:shadow-lg"
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{ width: size.width, height: iteration.isLoading ? 320 : size.height, overflow: "hidden" }}
      >
        {iteration.isLoading ? (
          <LoadingSkeleton />
        ) : (
          <iframe
            ref={iframeRef}
            title={iteration.label}
            sandbox="allow-same-origin"
            className="w-full h-full border-0 pointer-events-none rounded-xl"
            style={{ width: size.width, height: size.height }}
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

/** Premium loading state — animated gradient shimmer */
function LoadingSkeleton() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
      {/* Shimmer lines */}
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
