"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import { useCanvas } from "@/hooks/use-canvas";
import { useSettings } from "@/hooks/use-settings";
import { DesignCard, DEFAULT_FRAME_WIDTH as FRAME_WIDTH } from "@/components/design-card";
import { usePersistedGroups } from "@/hooks/use-persisted-groups";
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
  const { groups, setGroups, resetSession } = usePersistedGroups();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [commentDraft, setCommentDraft] = useState<{
    iterationId: string;
    position: Point;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Drag state for moving frames
  const dragRef = useRef<{
    iterationId: string;
    startMouse: Point;
    startPos: Point;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeComment, setActiveComment] = useState<CommentType | null>(null);
  const [selectedIterationId, setSelectedIterationId] = useState<string | null>(null);

  const commentCountRef = useRef(0);

  // Dev mode from URL
  useEffect(() => {
    setDevMode(new URLSearchParams(window.location.search).has("devMode"));
  }, []);

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
        setSelectedIterationId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIterationId) {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            iterations: g.iterations.filter((iter) => iter.id !== selectedIterationId),
          })).filter((g) => g.iterations.length > 0)
        );
        setSelectedIterationId(null);
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
  }, [selectedIterationId]);

  // Grid positioning — 2 columns, centered in viewport
  const H_GAP = 60;
  const V_GAP = 80;
  const GROUP_GAP = 120;
  const ROW_HEIGHT = 700;
  const COLS = 2;
  const ITEM_WIDTH = 640; // reasonable default for grid spacing

  const getGridPositions = useCallback(
    (count: number): Point[] => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gridW = COLS * ITEM_WIDTH + (COLS - 1) * H_GAP;

      let startX: number;
      let startY: number;

      if (groups.length === 0) {
        // Center in current viewport
        startX = (vw / 2 - canvas.offset.x) / canvas.scale - gridW / 2;
        startY = (vh / 3 - canvas.offset.y) / canvas.scale;
      } else {
        let maxBottom = 0;
        for (const g of groups) {
          for (const iter of g.iterations) {
            maxBottom = Math.max(maxBottom, iter.position.y + (iter.height || ROW_HEIGHT));
          }
        }
        startX = groups[0].iterations[0]?.position.x ?? 0;
        startY = maxBottom + GROUP_GAP;
      }

      return Array.from({ length: count }, (_, i) => ({
        x: startX + (i % COLS) * (ITEM_WIDTH + H_GAP),
        y: startY + Math.floor(i / COLS) * (ROW_HEIGHT + V_GAP),
      }));
    },
    [canvas.offset, canvas.scale, groups]
  );

  const handleExportOtto = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: groups.map((g) => ({
        ...g,
        iterations: g.iterations.map((iter) => ({
          id: iter.id,
          label: iter.label,
          html: iter.html,
          width: iter.width,
          height: iter.height,
          position: iter.position,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canvas-${Date.now()}.otto`;
    a.click();
    URL.revokeObjectURL(url);
  }, [groups]);

  const handleImportOtto = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".otto";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!data.groups || !Array.isArray(data.groups)) {
            alert("Invalid .otto file");
            return;
          }
          setGroups(data.groups.map((g: Record<string, unknown>) => ({
            ...g,
            iterations: (g.iterations as Record<string, unknown>[]).map((iter: Record<string, unknown>) => ({
              ...iter,
              isLoading: false,
              isRegenerating: false,
            })),
          })));
        } catch {
          alert("Failed to parse .otto file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      const groupId = `group-${Date.now()}`;

      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Planning call — model decides how many concepts
        let iterationCount = 4;
        let concepts: string[] = [];

        try {
          const planRes = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, apiKey: settings.apiKey || undefined }),
            signal: controller.signal,
          });
          if (planRes.ok) {
            const plan = await planRes.json();
            iterationCount = plan.count || 4;
            concepts = plan.concepts || [];
          }
        } catch {
          // Planning failed — continue with default 4
        }

        const positions = getGridPositions(iterationCount);

        const newGroup: GenerationGroup = {
          id: groupId,
          prompt,
          iterations: [],
          position: positions[0],
          createdAt: Date.now(),
        };

        setGroups((prev) => [...prev, newGroup]);

        // Generate sequentially — show one loading placeholder at a time
        for (let i = 0; i < iterationCount; i++) {
          if (controller.signal.aborted) break;

          const iterId = `${groupId}-iter-${i}`;

          // Add loading placeholder for this variation
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                iterations: [
                  ...g.iterations,
                  {
                    id: iterId,
                    html: "",
                    label: `Variation ${i + 1}`,
                    position: positions[i],
                    width: 400,
                    height: 300,
                    prompt,
                    comments: [],
                    isLoading: true,
                  },
                ],
              };
            })
          );

          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              variationIndex: i,
              concept: concepts[i] || undefined,
              apiKey: settings.apiKey || undefined,
              model: settings.model, systemPrompt: settings.systemPrompt || undefined,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Generation failed");
          }

          const data = await res.json();
          const iter = data.iteration;

          // Replace placeholder with completed result
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                iterations: g.iterations.map((existing) => {
                  if (existing.id !== iterId) return existing;
                  return {
                    ...existing,
                    html: iter?.html || "<p>Failed to generate</p>",
                    label: iter?.label || existing.label,
                    width: iter?.width || existing.width,
                    height: iter?.height || existing.height,
                    isLoading: false,
                  };
                }),
              };
            })
          );

          // Zoom to fit all frames so far
          setTimeout(() => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let j = 0; j <= i; j++) {
              const w = (j === i ? iter?.width : undefined) || FRAME_WIDTH;
              const h = (j === i ? iter?.height : undefined) || 400;
              minX = Math.min(minX, positions[j].x);
              minY = Math.min(minY, positions[j].y);
              maxX = Math.max(maxX, positions[j].x + w);
              maxY = Math.max(maxY, positions[j].y + h);
            }
            canvas.zoomToFit({ minX, minY, maxX, maxY });
          }, 150);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Keep completed iterations, remove any still-loading ones
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return { ...g, iterations: g.iterations.filter((iter) => !iter.isLoading) };
            }).filter((g) => g.iterations.length > 0)
          );
        } else {
          const msg = err instanceof Error ? err.message : "Generation failed";
          console.error("Generation failed:", msg);
          // Mark remaining loading iterations as failed
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                iterations: g.iterations.map((iter) => {
                  if (!iter.isLoading) return iter; // already completed
                  return {
                    ...iter,
                    html: `<div style="padding:32px;color:#666;font-family:system-ui">
                      <p style="font-size:14px">⚠ ${msg}</p>
                      <p style="font-size:12px;margin-top:8px;color:#999">Check Settings or try again</p>
                    </div>`,
                    isLoading: false,
                  };
                }),
              };
            })
          );
        }
      } finally {
        abortRef.current = null;
        setIsGenerating(false);
      }
    },
    [getGridPositions, settings.apiKey, settings.model, canvas]
  );

  const handleRemix = useCallback(
    async (sourceIteration: DesignIteration, remixPrompt: string) => {
      setIsGenerating(true);
      const positions = getGridPositions(1);
      const remixId = `remix-${Date.now()}`;

      const placeholder: DesignIteration = {
        id: remixId,
        html: "",
        label: "Remixing...",
        position: positions[0],
        width: sourceIteration.width || 400,
        height: sourceIteration.height || 300,
        prompt: remixPrompt,
        comments: [],
        isLoading: true,
      };

      // Find the group this iteration belongs to, or create a new one
      const sourceGroup = groups.find((g) => g.iterations.some((it) => it.id === sourceIteration.id));
      const newGroup: GenerationGroup = {
        id: `group-${remixId}`,
        prompt: `Remix: ${remixPrompt}`,
        iterations: [placeholder],
        position: positions[0],
        createdAt: Date.now(),
      };

      setGroups((prev) => [...prev, newGroup]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: sourceIteration.prompt,
            revision: remixPrompt,
            existingHtml: sourceIteration.html,
            apiKey: settings.apiKey || undefined,
            model: settings.model, systemPrompt: settings.systemPrompt || undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Remix failed");
        }

        const data = await res.json();
        const iter = data.iteration || data.iterations?.[0];

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== newGroup.id) return g;
            return {
              ...g,
              iterations: [{
                ...placeholder,
                html: iter?.html || "<p>Remix failed</p>",
                label: iter?.label || "Remix",
                width: iter?.width || placeholder.width,
                height: iter?.height || placeholder.height,
                isLoading: false,
              }],
            };
          })
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== newGroup.id) return g;
              return { ...g, iterations: g.iterations.filter((iter) => !iter.isLoading) };
            }).filter((g) => g.iterations.length > 0)
          );
        } else {
          const msg = err instanceof Error ? err.message : "Remix failed";
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== newGroup.id) return g;
              return {
                ...g,
                iterations: [{ ...placeholder, html: `<div style="padding:32px;color:#666;font-family:system-ui"><p style="font-size:14px">⚠ ${msg}</p></div>`, isLoading: false }],
              };
            })
          );
        }
      } finally {
        abortRef.current = null;
        setIsGenerating(false);
      }
    },
    [getGridPositions, settings.apiKey, settings.model, groups]
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
              model: settings.model, systemPrompt: settings.systemPrompt || undefined,
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

  // Frame drag handlers
  const handleFrameDragStart = useCallback(
    (iterationId: string, e: React.MouseEvent) => {
      if (toolMode !== "select" || spaceHeld) return;
      e.stopPropagation(); // prevent canvas pan

      // Find the iteration's current position
      for (const group of groups) {
        const iter = group.iterations.find((it) => it.id === iterationId);
        if (iter) {
          dragRef.current = {
            iterationId,
            startMouse: { x: e.clientX, y: e.clientY },
            startPos: { ...iter.position },
          };
          setDraggingId(iterationId);
          break;
        }
      }
    },
    [toolMode, spaceHeld, groups]
  );

  const handleFrameDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startMouse.x) / canvas.scale;
      const dy = (e.clientY - dragRef.current.startMouse.y) / canvas.scale;

      const newPos = {
        x: dragRef.current.startPos.x + dx,
        y: dragRef.current.startPos.y + dy,
      };

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          iterations: g.iterations.map((iter) =>
            iter.id === dragRef.current!.iterationId
              ? { ...iter, position: newPos }
              : iter
          ),
        }))
      );
    },
    [canvas.scale]
  );

  const handleFrameDragEnd = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
  }, []);

  const canPan = (spaceHeld || toolMode === "select") && !draggingId;

  const allIterations = groups.flatMap((g) => g.iterations.map((iter) => ({ ...iter, groupId: g.id })));

  return (
    <div className="h-screen w-screen overflow-hidden relative select-none">
      {/* Canvas layer — this is what pans/zooms */}
      <div
        ref={combinedCanvasRef}
        className={`absolute inset-0 canvas-dots ${
          canPan ? "cursor-grab active:cursor-grabbing" : ""
        } ${toolMode === "comment" && !spaceHeld ? "cursor-crosshair" : ""}`}
        onMouseDown={(e) => {
          setSelectedIterationId(null);
          if (canPan) canvas.onMouseDown(e);
        }}
        onMouseMove={(e) => {
          if (draggingId) { handleFrameDragMove(e); } else { canvas.onMouseMove(e); }
        }}
        onMouseUp={() => {
          if (draggingId) { handleFrameDragEnd(); } else { canvas.onMouseUp(); }
        }}
        onMouseLeave={() => {
          if (draggingId) { handleFrameDragEnd(); } else { canvas.onMouseUp(); }
        }}
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
              isSelectMode={toolMode === "select" && !spaceHeld}
              isDragging={draggingId === iteration.id}
              isSelected={selectedIterationId === iteration.id}
              onSelect={() => setSelectedIterationId(iteration.id)}
              onAddComment={handleAddComment}
              onClickComment={handleClickComment}
              onDragStart={(e) => handleFrameDragStart(iteration.id, e)}
              onRemix={handleRemix}
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
                Otto Canvas
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
        onNewSession={() => setShowResetConfirm(true)}
        onExport={handleExportOtto}
        onImport={handleImportOtto}
        isOwnKey={isOwnKey}
        model={settings.model}
        hasFrames={groups.length > 0}
      />

      <PromptBar onSubmit={handleGenerate} isGenerating={isGenerating} onCancel={() => abortRef.current?.abort()} />

      {/* Dev mode build badge */}
      {devMode && (
        <div className="fixed bottom-2 left-2 z-40 text-[9px] font-mono text-gray-400 bg-black/5 backdrop-blur-sm px-2 py-1 rounded-md select-all">
          {process.env.NEXT_PUBLIC_GIT_HASH}
        </div>
      )}

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
          devMode={devMode}
        />
      )}

      {/* Reset confirm dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="relative bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] p-8 w-[380px] max-w-[90vw] text-center">
            <h3 className="text-[15px] font-semibold text-gray-800 mb-2">Start new session?</h3>
            <p className="text-[13px] text-gray-500 mb-6">This will clear your current canvas. Generated designs will be lost.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-[13px] font-medium text-gray-600 hover:text-gray-800 px-5 py-2.5 rounded-xl hover:bg-black/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetSession();
                  canvas.resetView();
                  setShowResetConfirm(false);
                }}
                className="text-[13px] font-medium text-white bg-red-500/90 hover:bg-red-500 px-5 py-2.5 rounded-xl transition-all"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
