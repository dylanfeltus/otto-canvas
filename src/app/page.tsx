"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import { useCanvas } from "@/hooks/use-canvas";
import { useSettings } from "@/hooks/use-settings";
import { DesignCard } from "@/components/design-card";
import { PromptBar } from "@/components/prompt-bar";
import { Toolbar } from "@/components/toolbar";
import { CommentInput } from "@/components/comment-input";
import { SettingsModal } from "@/components/settings-modal";
import { PromptLibrary } from "@/components/prompt-library";
import type {
  DesignIteration,
  GenerationGroup,
  ToolMode,
  Comment as CommentType,
  Point,
} from "@/lib/types";

export default function Home() {
  const canvas = useCanvas();
  const { settings, setSettings, isOwnKey, availableModels, isProbing } = useSettings();
  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const combinedCanvasRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    canvasElRef.current = el;
    canvas.setCanvasRef(el);
  }, [canvas.setCanvasRef]);
  const [groups, setGroups] = useState<GenerationGroup[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [commentDraft, setCommentDraft] = useState<{
    iterationId: string;
    position: Point;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [activeComment, setActiveComment] = useState<CommentType | null>(null);

  const commentCountRef = useRef(0);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "v" || e.key === "V") setToolMode("select");
      if (e.key === "c" || e.key === "C") setToolMode("comment");
      if (e.key === " ") {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === "Escape") {
        setCommentDraft(null);
        setActiveComment(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Calculate positions that fit ALL iterations in the current viewport
  const getViewportFittedPositions = useCallback(
    (count: number): Point[] => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardWidth = 400;
      const gap = 40;
      const totalWidth = count * cardWidth + (count - 1) * gap;

      // If total width fits in viewport, lay out in a row centered
      // Otherwise, do a 2-column grid
      const padding = 80; // breathing room from edges
      const availableWidth = vw - padding * 2;
      const availableHeight = vh - padding * 2 - 120; // room for prompt bar

      let positions: Point[];

      if (totalWidth <= availableWidth / canvas.scale) {
        // Single row, centered in viewport
        const startX =
          (vw / 2 - canvas.offset.x) / canvas.scale - totalWidth / 2;
        const centerY =
          (vh / 2 - canvas.offset.y - 60) / canvas.scale - 150;

        positions = Array.from({ length: count }, (_, i) => ({
          x: startX + i * (cardWidth + gap),
          y: centerY,
        }));
      } else {
        // 2-column grid
        const cols = 2;
        const gridWidth = cols * cardWidth + (cols - 1) * gap;
        const startX =
          (vw / 2 - canvas.offset.x) / canvas.scale - gridWidth / 2;
        const startY =
          (padding - canvas.offset.y) / canvas.scale;

        positions = Array.from({ length: count }, (_, i) => ({
          x: startX + (i % cols) * (cardWidth + gap),
          y: startY + Math.floor(i / cols) * (380 + gap),
        }));
      }

      return positions;
    },
    [canvas.offset, canvas.scale]
  );

  const handleGenerate = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      const groupId = `group-${Date.now()}`;
      const iterationCount = 4;
      const positions = getViewportFittedPositions(iterationCount);

      // Create placeholder iterations
      const placeholders: DesignIteration[] = Array.from(
        { length: iterationCount },
        (_, i) => ({
          id: `${groupId}-iter-${i}`,
          html: "",
          label: `Variation ${i + 1}`,
          position: positions[i],
          width: 400,
          height: 300,
          prompt,
          comments: [],
          isLoading: true,
        })
      );

      const newGroup: GenerationGroup = {
        id: groupId,
        prompt,
        iterations: placeholders,
        position: positions[0],
        createdAt: Date.now(),
      };

      setGroups((prev) => [...prev, newGroup]);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, count: iterationCount, apiKey: settings.apiKey || undefined, model: settings.model }),
        });

        if (!res.ok) throw new Error("Generation failed");

        const data = await res.json();

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              iterations: g.iterations.map((iter, i) => ({
                ...iter,
                html: data.iterations[i]?.html || "<p>Failed to generate</p>",
                label: data.iterations[i]?.label || iter.label,
                isLoading: false,
              })),
            };
          })
        );
      } catch (err) {
        console.error("Generation failed:", err);
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              iterations: g.iterations.map((iter) => ({
                ...iter,
                html: `<div style="padding:32px;color:#666;font-family:system-ui">
                  <p style="font-size:14px">⚠ Failed to generate design</p>
                  <p style="font-size:12px;margin-top:8px;color:#999">Check API key or try again</p>
                </div>`,
                isLoading: false,
              })),
            };
          })
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [getViewportFittedPositions]
  );

  const handleAddComment = useCallback(
    (iterationId: string, position: Point) => {
      const rect = canvasElRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Find the iteration to compute screen position
      for (const group of groups) {
        const iter = group.iterations.find((it) => it.id === iterationId);
        if (iter) {
          const absScreenX =
            (iter.position.x + position.x) * canvas.scale +
            canvas.offset.x +
            rect.left;
          const absScreenY =
            (iter.position.y + position.y) * canvas.scale +
            canvas.offset.y +
            rect.top;
          setCommentDraft({
            iterationId,
            position,
            screenX: absScreenX,
            screenY: absScreenY,
          });
          return;
        }
      }
    },
    [canvas.offset, canvas.scale, groups]
  );

  const handleCommentSubmit = useCallback(
    async (text: string) => {
      if (!commentDraft) return;
      commentCountRef.current += 1;

      const newComment: CommentType = {
        id: `comment-${Date.now()}`,
        position: commentDraft.position,
        text,
        number: commentCountRef.current,
        createdAt: Date.now(),
      };

      // Add comment to the iteration
      let targetIteration: DesignIteration | null = null;

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          iterations: g.iterations.map((iter) => {
            if (iter.id === commentDraft.iterationId) {
              targetIteration = iter;
              return {
                ...iter,
                comments: [...iter.comments, newComment],
                isRegenerating: true,
              };
            }
            return iter;
          }),
        }))
      );

      setCommentDraft(null);

      // Trigger revision
      if (targetIteration) {
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: (targetIteration as DesignIteration).prompt,
              revision: text,
              existingHtml: (targetIteration as DesignIteration).html,
              apiKey: settings.apiKey || undefined,
              model: settings.model,
            }),
          });

          if (!res.ok) throw new Error("Revision failed");

          const data = await res.json();

          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              iterations: g.iterations.map((iter) => {
                if (iter.id === commentDraft.iterationId) {
                  return {
                    ...iter,
                    html: data.iterations[0]?.html || iter.html,
                    isRegenerating: false,
                  };
                }
                return iter;
              }),
            }))
          );
        } catch (err) {
          console.error("Revision failed:", err);
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              iterations: g.iterations.map((iter) => {
                if (iter.id === commentDraft.iterationId) {
                  return { ...iter, isRegenerating: false };
                }
                return iter;
              }),
            }))
          );
        }
      }
    },
    [commentDraft]
  );

  const handleClickComment = useCallback((comment: CommentType) => {
    setActiveComment((prev) => (prev?.id === comment.id ? null : comment));
  }, []);

  const canPan = spaceHeld || toolMode === "select";

  const allIterations = groups.flatMap((g) => g.iterations);

  return (
    <div className="h-screen w-screen overflow-hidden relative select-none">
      {/* Canvas layer — this is what pans/zooms */}
      <div
        ref={combinedCanvasRef}
        className={`absolute inset-0 canvas-dots ${
          canPan ? "cursor-grab active:cursor-grabbing" : ""
        } ${toolMode === "comment" && !spaceHeld ? "cursor-crosshair" : ""}`}
        onMouseDown={canPan ? canvas.onMouseDown : undefined}
        onMouseMove={canvas.onMouseMove}
        onMouseUp={canvas.onMouseUp}
        onMouseLeave={canvas.onMouseUp}
        onWheel={canvas.onWheel}
      >
        {/* Transform layer — only this moves/scales */}
        <div
          style={{
            transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) scale(${canvas.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {allIterations.map((iteration) => (
            <DesignCard
              key={iteration.id}
              iteration={iteration}
              isCommentMode={toolMode === "comment" && !spaceHeld}
              onAddComment={handleAddComment}
              onClickComment={handleClickComment}
              scale={canvas.scale}
              apiKey={settings.apiKey || undefined}
              model={settings.model}
            />
          ))}
        </div>

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-300 mb-2">
                DesignBuddy Canvas
              </h1>
              <p className="text-gray-400/70 text-sm">
                Type a prompt below to generate designs
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed UI — OUTSIDE canvas transform, never moves/scales */}
      <Toolbar
        mode={toolMode}
        onModeChange={setToolMode}
        scale={canvas.scale}
        onZoomIn={canvas.zoomIn}
        onZoomOut={canvas.zoomOut}
        onResetView={canvas.resetView}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLibrary={() => setShowLibrary(true)}
        isOwnKey={isOwnKey}
        model={settings.model}
      />

      <PromptBar onSubmit={handleGenerate} isGenerating={isGenerating} />

      {/* Comment input popover */}
      {commentDraft && (
        <CommentInput
          position={{
            screenX: commentDraft.screenX,
            screenY: commentDraft.screenY,
          }}
          onSubmit={handleCommentSubmit}
          onCancel={() => setCommentDraft(null)}
        />
      )}

      {/* Active comment detail panel */}
      {activeComment && (
        <div className="fixed top-4 right-4 z-50 bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] p-4 w-[260px]">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-500/90 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
              {activeComment.number}
            </span>
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Comment #{activeComment.number}
            </span>
            <button
              onClick={() => setActiveComment(null)}
              className="ml-auto text-gray-400 hover:text-gray-600 text-sm leading-none p-1 rounded-lg hover:bg-black/5 transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">{activeComment.text}</p>
        </div>
      )}

      {/* Prompt library slide-out */}
      <PromptLibrary
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onUsePrompt={(prompt) => {
          setShowLibrary(false);
          handleGenerate(prompt);
        }}
      />

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setShowSettings(false)}
          isOwnKey={isOwnKey}
          availableModels={availableModels}
          isProbing={isProbing}
        />
      )}
    </div>
  );
}
