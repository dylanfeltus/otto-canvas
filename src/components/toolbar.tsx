"use client";

import type { ToolMode } from "@/lib/types";

interface ToolbarProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function Toolbar({
  mode,
  onModeChange,
  scale,
  onZoomIn,
  onZoomOut,
  onResetView,
}: ToolbarProps) {
  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-1 bg-[#1e1e1e] rounded-xl px-1.5 py-1.5 shadow-2xl">
      {/* Select tool */}
      <ToolButton
        active={mode === "select"}
        onClick={() => onModeChange("select")}
        title="Select (V)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 3l14 9-7 1-4 7z" fill={mode === "select" ? "currentColor" : "none"} />
        </svg>
      </ToolButton>

      {/* Comment tool */}
      <ToolButton
        active={mode === "comment"}
        onClick={() => onModeChange("comment")}
        title="Comment (C)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={mode === "comment" ? "currentColor" : "none"} />
        </svg>
      </ToolButton>

      <div className="w-px h-6 bg-gray-600 mx-1" />

      {/* Zoom controls */}
      <ToolButton onClick={onZoomOut} title="Zoom out">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ToolButton>

      <button
        onClick={onResetView}
        className="text-xs text-gray-400 hover:text-white px-1.5 py-1 rounded min-w-[42px] text-center transition-colors"
        title="Reset zoom"
      >
        {Math.round(scale * 100)}%
      </button>

      <ToolButton onClick={onZoomIn} title="Zoom in">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ToolButton>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-blue-500 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
