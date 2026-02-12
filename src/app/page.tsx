"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvas } from "@/hooks/use-canvas";
import { DesignCard } from "@/components/design-card";
import { PromptBar } from "@/components/prompt-bar";
import { Toolbar } from "@/components/toolbar";
import { CommentInput } from "@/components/comment-input";
import type {
  DesignIteration,
  GenerationGroup,
  ToolMode,
  Comment as CommentType,
  Point,
} from "@/lib/types";

export default function Home() {
  const canvas = useCanvas();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<GenerationGroup[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
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

  // Calculate where to place new generations
  const getNextGroupPosition = useCallback((): Point => {
    if (groups.length === 0) {
      // Center of viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: (vw / 2 - canvas.offset.x) / canvas.scale - 200,
        y: (vh / 2 - canvas.offset.y) / canvas.scale - 100,
      };
    }
    // Below the last group
    const last = groups[groups.length - 1];
    return {
      x: last.position.x,
      y: last.position.y + 600,
    };
  }, [groups, canvas.offset, canvas.scale]);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      const groupId = `group-${Date.now()}`;
      const pos = getNextGroupPosition();
      const iterationCount = 4;

      // Create placeholder iterations
      const placeholders: DesignIteration[] = Array.from(
        { length: iterationCount },
        (_, i) => ({
          id: `${groupId}-iter-${i}`,
          html: "",
          label: `Variation ${i + 1}`,
          position: { x: pos.x + i * 440, y: pos.y },
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
        position: pos,
        createdAt: Date.now(),
      };

      setGroups((prev) => [...prev, newGroup]);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, count: iterationCount }),
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
    [getNextGroupPosition]
  );

  const handleAddComment = useCallback(
    (iterationId: string, position: Point) => {
      // Get screen position for the comment input popover
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = position.x * canvas.scale + canvas.offset.x + rect.left;
      const screenY = position.y * canvas.scale + canvas.offset.y + rect.top;

      // Find the iteration to get its canvas position
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
      let targetGroupId = "";

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          iterations: g.iterations.map((iter) => {
            if (iter.id === commentDraft.iterationId) {
              targetIteration = iter;
              targetGroupId = g.id;
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
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`w-full h-full canvas-dots ${
          canPan ? "cursor-grab active:cursor-grabbing" : ""
        } ${toolMode === "comment" && !spaceHeld ? "cursor-crosshair" : ""}`}
        onMouseDown={canPan ? canvas.onMouseDown : undefined}
        onMouseMove={canvas.onMouseMove}
        onMouseUp={canvas.onMouseUp}
        onMouseLeave={canvas.onMouseUp}
        onWheel={canvas.onWheel}
      >
        {/* Transform layer */}
        <div
          style={{
            transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) scale(${canvas.scale})`,
            transformOrigin: "0 0",
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
            />
          ))}
        </div>

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-400 mb-2">
                DesignBuddy Canvas
              </h1>
              <p className="text-gray-400 text-sm">
                Type a prompt below to generate designs
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <Toolbar
        mode={toolMode}
        onModeChange={setToolMode}
        scale={canvas.scale}
        onZoomIn={canvas.zoomIn}
        onZoomOut={canvas.zoomOut}
        onResetView={canvas.resetView}
      />

      {/* Prompt bar */}
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

      {/* Active comment detail */}
      {activeComment && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-[260px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
              {activeComment.number}
            </span>
            <span className="text-xs text-gray-400">
              Comment #{activeComment.number}
            </span>
            <button
              onClick={() => setActiveComment(null)}
              className="ml-auto text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-700">{activeComment.text}</p>
        </div>
      )}
    </div>
  );
}
