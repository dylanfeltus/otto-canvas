"use client";

import { type PipelineStatus, STAGE_CONFIG } from "@/lib/pipeline";

interface PipelineStatusBarProps {
  status: PipelineStatus;
  x: number;
  y: number;
  width: number;
  frameHeight: number;
}

export function PipelineStatusOverlay({ status, x, y, width, frameHeight }: PipelineStatusBarProps) {
  const config = STAGE_CONFIG[status.stage];
  const isDone = status.stage === "done";
  const isError = status.stage === "error";
  const isQueued = status.stage === "queued";

  if (isDone) return null;

  const topOffset = y + frameHeight + 8;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: topOffset, width }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-black/[0.04] overflow-hidden">
          {!isQueued && (
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isError
                  ? "bg-red-400"
                  : "bg-gradient-to-r from-blue-400 to-violet-400"
              } ${status.stage === "layout" || status.stage === "images" ? "animate-pulse" : ""}`}
              style={{ width: `${Math.max(status.progress * 100, 5)}%` }}
            />
          )}
        </div>
        <span
          className={`text-[10px] font-medium whitespace-nowrap ${
            isError ? "text-red-400" : status.skipped ? "text-amber-400/80" : "text-gray-400/70"
          }`}
        >
          {status.skipped ? `⏭ ${status.reason || "Skipped"}` : config.label}
        </span>
      </div>
    </div>
  );
}
