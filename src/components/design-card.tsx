"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";
import { ExportMenu } from "./export-menu";

interface DesignCardProps {
  iteration: DesignIteration;
  isCommentMode: boolean;
  onAddComment: (iterationId: string, position: Point) => void;
  onClickComment: (comment: CommentType) => void;
  scale: number;
}

export function DesignCard({
  iteration,
  isCommentMode,
  onAddComment,
  onClickComment,
  scale,
}: DesignCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 400, height: 300 });

  useEffect(() => {
    if (!containerRef.current) return;

    if (!shadowRef.current) {
      shadowRef.current = containerRef.current.attachShadow({ mode: "open" });
    }

    shadowRef.current.innerHTML = iteration.html;

    // Measure content after render
    requestAnimationFrame(() => {
      if (shadowRef.current) {
        const el = shadowRef.current.firstElementChild as HTMLElement;
        if (el) {
          const w = Math.max(el.scrollWidth, el.offsetWidth, 200);
          const h = Math.max(el.scrollHeight, el.offsetHeight, 100);
          setNaturalSize({ width: Math.min(w, 800), height: Math.min(h, 1200) });
        }
      }
    });
  }, [iteration.html]);

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
            <ExportMenu html={iteration.html} label={iteration.label} />
          </div>
        )}
      </div>

      {/* Design render area */}
      <div
        className={`relative bg-white rounded-xl shadow-md border border-gray-200/80 overflow-hidden transition-all ${
          isCommentMode
            ? "cursor-crosshair ring-2 ring-blue-400/20 hover:ring-blue-400/40 hover:shadow-lg"
            : "cursor-default hover:shadow-lg"
        } ${iteration.isRegenerating ? "opacity-60" : ""}`}
        style={{ minHeight: naturalSize.height }}
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
            className="w-full"
            style={{ minHeight: 100 }}
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
      {/* Pulse ring for new comments */}
      {isNew && (
        <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
      )}
      {/* Drop shadow / anchor indicator */}
      <span
        className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-2 bg-blue-400/60"
      />
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
