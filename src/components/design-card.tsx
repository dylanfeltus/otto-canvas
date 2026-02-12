"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignIteration, Comment as CommentType, Point } from "@/lib/types";

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
      {/* Label */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded">
          {iteration.label}
        </span>
        {iteration.isRegenerating && (
          <span className="text-xs text-blue-500 animate-pulse">Revising...</span>
        )}
      </div>

      {/* Design render area */}
      <div
        className={`relative bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden transition-shadow ${
          isCommentMode
            ? "cursor-crosshair hover:shadow-lg hover:border-blue-300"
            : "cursor-default"
        }`}
        style={{ minHeight: naturalSize.height }}
      >
        {iteration.isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-32 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
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
  return (
    <button
      className="absolute z-20 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shadow-lg hover:bg-blue-600 hover:scale-110 transition-all cursor-pointer border-2 border-white"
      style={{
        left: comment.position.x - 12,
        top: comment.position.y - 12,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={comment.text}
    >
      {comment.number}
    </button>
  );
}
