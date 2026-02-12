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
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 420, height: 300 });

  const measureContent = useCallback(() => {
    if (!shadowRef.current) return;

    // Wait for images/fonts then measure
    const measure = () => {
      if (!shadowRef.current) return;
      const root = shadowRef.current.firstElementChild as HTMLElement;
      if (!root) return;

      // Force layout recalc
      root.style.width = "max-content";
      root.style.position = "relative";

      // Walk all children to find actual bounding box
      const allEls = shadowRef.current.querySelectorAll("*");
      let maxW = root.offsetWidth;
      let maxH = root.offsetHeight;

      allEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        maxW = Math.max(maxW, htmlEl.scrollWidth, htmlEl.offsetWidth);
        maxH = Math.max(maxH, htmlEl.scrollHeight + htmlEl.offsetTop);
      });

      // Also check root scroll dimensions
      maxW = Math.max(maxW, root.scrollWidth);
      maxH = Math.max(maxH, root.scrollHeight);

      const w = Math.max(Math.min(maxW + 2, 900), 200);
      const h = Math.max(Math.min(maxH + 2, 2000), 80);

      setNaturalSize({ width: w, height: h });

      // Reset style overrides
      root.style.width = "";
      root.style.position = "";
    };

    // Measure multiple times to catch late-loading content
    requestAnimationFrame(measure);
    setTimeout(measure, 100);
    setTimeout(measure, 500);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !iteration.html) return;

    if (!shadowRef.current) {
      shadowRef.current = containerRef.current.attachShadow({ mode: "open" });
    }

    // Inject a reset + the generated HTML
    shadowRef.current.innerHTML = `<style>:host { display: block; } * { box-sizing: border-box; }</style>${iteration.html}`;

    measureContent();
  }, [iteration.html, measureContent]);

  const handleClick = (e: React.MouseEvent) => {
    if (!isCommentMode) return;
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
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
        width: naturalSize.width,
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

      {/* Design render area — NO overflow:hidden so content can be measured properly */}
      <div
        className={`relative bg-white rounded-xl shadow-md border border-gray-200/80 transition-all ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40 hover:shadow-lg"
            : "cursor-default hover:shadow-lg"
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{
          height: iteration.isLoading ? 300 : naturalSize.height,
          overflow: "hidden",
        }}
      >
        {iteration.isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded-lg w-3/4" />
            <div className="h-4 bg-gray-200 rounded-lg w-full" />
            <div className="h-4 bg-gray-200 rounded-lg w-5/6" />
            <div className="h-32 bg-gray-100 rounded-lg" />
            <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
          </div>
        ) : (
          <div
            ref={containerRef}
            onClick={handleClick}
            className="w-full h-full"
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
