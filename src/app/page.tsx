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
import { PipelineStatusOverlay } from "@/components/pipeline-status";
import { OnboardingModal } from "@/components/onboarding-modal";
import { GuidedTour } from "@/components/guided-tour";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { PipelineStatus } from "@/lib/pipeline";
import type {
  DesignIteration,
  GenerationGroup,
  ToolMode,
  Comment as CommentType,
  Point,
} from "@/lib/types";

export default function Home() {
  const canvas = useCanvas();
  const { settings, setSettings, isOwnKey, hasGeminiKey, availableModels, isProbing } = useSettings();
  const onboarding = useOnboarding();
  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const combinedCanvasRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    canvasElRef.current = el;
    canvas.setCanvasRef(el);
  }, [canvas.setCanvasRef]);
  const { groups, setGroups, resetSession } = usePersistedGroups();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<Record<string, PipelineStatus>>({});
  const [genStatus, setGenStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const quickMode = settings.quickMode;
  const [showGitHash, setShowGitHash] = useState(false);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Rubber band selection state
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const commentCountRef = useRef(0);

  // Dev mode from URL
  useEffect(() => {
    setShowGitHash(new URLSearchParams(window.location.search).has("devMode"));
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
        setSelectedIds(new Set());
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            iterations: g.iterations.filter((iter) => !selectedIds.has(iter.id)),
          })).filter((g) => g.iterations.length > 0)
        );
        setSelectedIds(new Set());
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
  }, [selectedIds]);

  // Grid positioning — 2 columns, centered in viewport
  const H_GAP = 60;
  const GROUP_GAP = 120;
  const ROW_HEIGHT = 700;
  const ITEM_WIDTH = 640;

  const getGridPositions = useCallback(
    (count: number): Point[] => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gridW = count * ITEM_WIDTH + (count - 1) * H_GAP;

      let startX: number;
      let startY: number;

      if (groups.length === 0) {
        // Center first row in viewport
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

      // All frames in a single horizontal row
      return Array.from({ length: count }, (_, i) => ({
        x: startX + i * (ITEM_WIDTH + H_GAP),
        y: startY,
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
            id: g.id || `group-${Date.now()}-${Math.random()}`,
            prompt: g.prompt || "",
            position: g.position || { x: 0, y: 0 },
            createdAt: g.createdAt || Date.now(),
            iterations: ((g.iterations as Record<string, unknown>[]) || []).map((iter: Record<string, unknown>) => ({
              id: iter.id || `iter-${Date.now()}-${Math.random()}`,
              html: iter.html || "",
              label: iter.label || "Imported",
              position: iter.position || { x: 0, y: 0 },
              width: iter.width || 600,
              height: iter.height || 400,
              prompt: iter.prompt || g.prompt || "",
              comments: iter.comments || [],
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

  // Variation styles for the pipeline
  const VARIATION_STYLES = [
    "Refined and premium — think Stripe or Linear. Subtle gradients, generous whitespace, sophisticated color palette",
    "Bold and expressive — vibrant colors, large confident typography, strong visual hierarchy, creative shapes",
    "Warm and approachable — friendly rounded shapes, warm color palette, inviting feel, human-centered",
    "Dark and dramatic — dark backgrounds, glowing accents, cinematic feel, high contrast, moody atmosphere",
  ];

  /** Helper: post JSON and return parsed response, throwing on error */
  const pipelinePost = useCallback(
    async (url: string, body: Record<string, unknown>, signal: AbortSignal) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request to ${url} failed`);
      return data;
    },
    []
  );

  /** Post-process: cap oversized sections */
  const capOversizedSections = useCallback((html: string): string => {
    let result = html;
    result = result.replace(
      /(<(?:section|div)\s[^>]*style="[^"]*?)height\s*:\s*(\d+)px/gi,
      (_match: string, prefix: string, heightStr: string) => {
        const h = parseInt(heightStr, 10);
        return h > 800 ? `${prefix}height:${h}px;max-height:800px;overflow:hidden` : _match;
      }
    );
    result = result.replace(
      /(<(?:section|div)\s[^>]*style="[^"]*?)min-height\s*:\s*(\d+)px/gi,
      (_match: string, prefix: string, heightStr: string) => {
        const h = parseInt(heightStr, 10);
        return h > 800 ? `${prefix}min-height:${h}px;max-height:800px;overflow:hidden` : _match;
      }
    );
    result = result.replace(
      /(<(?:section|div)\s[^>]*style="[^"]*?)(?:min-)?height\s*:\s*100vh/gi,
      (_match: string, prefix: string) => `${prefix}height:auto;max-height:800px;overflow:hidden`
    );
    return result;
  }, []);

  /** Process a single frame through chained API calls (layout → images → review → critique) */
  const runPipelineForFrame = useCallback(
    async (
      iterId: string,
      prompt: string,
      style: string,
      index: number,
      critique: string | undefined,
      signal: AbortSignal,
      revisionOpts?: { revision: string; existingHtml: string },
    ): Promise<{ html: string; label: string; width?: number; height?: number; critique?: string }> => {
      const isRevision = !!revisionOpts;
      const enableImages = !!(settings.geminiKey || settings.unsplashKey || settings.openaiKey);
      const enableQA = !isRevision;

      const availableSources: string[] = [];
      if (settings.unsplashKey) availableSources.push("unsplash");
      if (settings.openaiKey) availableSources.push("dalle");
      if (settings.geminiKey) availableSources.push("gemini");

      // --- Step 1: Layout ---
      setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "layout", progress: 0.2 } }));

      const layoutResult = await pipelinePost("/api/pipeline/layout", {
        prompt, style, model: settings.model,
        apiKey: settings.apiKey || undefined,
        systemPrompt: settings.systemPrompt || undefined,
        critique, availableSources,
        ...(revisionOpts || {}),
      }, signal);

      let html: string = layoutResult.html;
      const width: number | undefined = layoutResult.width;
      const height: number | undefined = layoutResult.height;

      // Show layout preview immediately
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          iterations: g.iterations.map((iter) =>
            iter.id !== iterId ? iter : { ...iter, html, width: width || iter.width, height: height || iter.height }
          ),
        }))
      );

      // --- Step 2: Images ---
      if (enableImages) {
        setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "images", progress: 0.45 } }));

        try {
          const imgResult = await pipelinePost("/api/pipeline/images", {
            html,
            geminiKey: settings.geminiKey || undefined,
            unsplashKey: settings.unsplashKey || undefined,
            openaiKey: settings.openaiKey || undefined,
          }, signal);

          if (imgResult.html && imgResult.imageCount > 0) {
            html = imgResult.html;
            // Show composited preview
            setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "compositing", progress: 0.65 } }));
            setGroups((prev) =>
              prev.map((g) => ({
                ...g,
                iterations: g.iterations.map((iter) =>
                  iter.id !== iterId ? iter : { ...iter, html }
                ),
              }))
            );
          }
        } catch (imgErr) {
          console.warn("Image step failed, continuing with placeholders:", imgErr);
        }
      } else {
        setPipelineStages((prev) => ({
          ...prev,
          [iterId]: { stage: "images", progress: 0.45, skipped: true, reason: "No image API keys — add Unsplash, DALL·E, or Gemini key in Settings" },
        }));
      }

      // --- Step 3: Visual QA ---
      if (enableQA) {
        setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "review", progress: 0.8 } }));
        try {
          const qaResult = await pipelinePost("/api/pipeline/review", {
            html, prompt, width, height,
            model: settings.model,
            apiKey: settings.apiKey || undefined,
          }, signal);
          if (qaResult.html) html = qaResult.html;
        } catch (qaErr) {
          console.warn("Visual QA failed, using unreviewed version:", qaErr);
        }
      }

      // Post-process
      html = capOversizedSections(html);

      const label = isRevision ? "Revised" : `Variation ${index + 1}`;

      // --- Step 4: Critique (fire and don't block result) ---
      let critiqueText: string | undefined;
      setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "done", progress: 1.0 } }));

      try {
        const critiqueResult = await pipelinePost("/api/pipeline/critique", {
          html, prompt,
          model: settings.model,
          apiKey: settings.apiKey || undefined,
        }, signal);
        critiqueText = critiqueResult.critique || undefined;
      } catch {
        // Critique is optional
      }

      return { html, label, width, height, critique: critiqueText };
    },
    [settings.apiKey, settings.model, settings.systemPrompt, settings.geminiKey, settings.unsplashKey, settings.openaiKey, pipelinePost, capOversizedSections]
  );

  const handleGenerate = useCallback(
    async (prompt: string) => {
      setIsGenerating(true);
      setGenStatus("Planning concepts…");
      const groupId = `group-${Date.now()}`;

      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        let iterationCount = settings.conceptCount || 4;
        let concepts: string[] = [];

        try {
          const planRes = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, count: iterationCount, apiKey: settings.apiKey || undefined, model: settings.model }),
            signal: controller.signal,
          });
          if (planRes.ok) {
            const plan = await planRes.json();
            concepts = (plan.concepts || []).slice(0, iterationCount);
          }
        } catch {
          // Planning failed — continue with defaults
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

        // Track completed frame dimensions for sequential positioning
        const completedFrames: { x: number; y: number; w: number; h: number }[] = [];

        const getNextPosition = (index: number): Point => {
          if (index === 0 || completedFrames.length === 0) return positions[0];
          // Always place to the right of previous frame — single horizontal row
          const prev = completedFrames[completedFrames.length - 1];
          return { x: prev.x + prev.w + H_GAP, y: prev.y };
        };

        const addPlaceholder = (iterId: string, index: number, pos: Point) => {
          setPipelineStages((prev) => ({
            ...prev,
            [iterId]: { stage: "layout", progress: 0.2 },
          }));
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
                    label: `Variation ${index + 1}`,
                    position: pos,
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
        };

        const completeFrame = (iterId: string, result: { html: string; label: string; width?: number; height?: number }, pos: Point) => {
          const w = result.width || FRAME_WIDTH;
          const h = result.height || 400;
          completedFrames.push({ x: pos.x, y: pos.y, w, h });

          setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "done", progress: 1 } }));
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                iterations: g.iterations.map((existing) => {
                  if (existing.id !== iterId) return existing;
                  return {
                    ...existing,
                    html: result.html || "<p>Failed to generate</p>",
                    label: result.label || existing.label,
                    width: result.width || existing.width,
                    height: result.height || existing.height,
                    isLoading: false,
                  };
                }),
              };
            })
          );

          // Zoom to fit all completed frames
          setTimeout(() => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const f of completedFrames) {
              minX = Math.min(minX, f.x);
              minY = Math.min(minY, f.y);
              maxX = Math.max(maxX, f.x + f.w);
              maxY = Math.max(maxY, f.y + f.h);
            }
            canvas.zoomToFit({ minX, minY, maxX, maxY });
          }, 150);
        };

        if (quickMode) {
          // Quick mode: create all placeholders upfront, run in parallel
          const iterIds: string[] = [];
          for (let i = 0; i < iterationCount; i++) {
            const iterId = `${groupId}-iter-${i}`;
            iterIds.push(iterId);
            addPlaceholder(iterId, i, positions[i]);
          }

          setGenStatus(`Running ${iterationCount} frames in parallel…`);
          const results = await Promise.allSettled(
            iterIds.map((iterId, i) =>
              runPipelineForFrame(
                iterId,
                prompt,
                concepts[i] || VARIATION_STYLES[i % VARIATION_STYLES.length],
                i,
                undefined,
                controller.signal,
              ).then((result) => {
                completeFrame(iterId, result, positions[i]);
                return result;
              })
            )
          );

          results.forEach((r, i) => {
            if (r.status === "rejected") {
              const msg = r.reason instanceof Error ? r.reason.message : "Failed";
              setPipelineStages((prev) => ({ ...prev, [iterIds[i]]: { stage: "error", progress: 0 } }));
              completeFrame(iterIds[i], {
                html: `<div style="padding:32px;color:#666;font-family:system-ui"><p style="font-size:14px">⚠ ${msg}</p></div>`,
                label: `Variation ${i + 1}`,
              }, positions[i]);
            }
          });

        } else {
          // Sequential critique loop: one frame at a time
          let critique: string | undefined;

          for (let i = 0; i < iterationCount; i++) {
            if (controller.signal.aborted) break;
            const iterId = `${groupId}-iter-${i}`;
            const pos = getNextPosition(i);

            setGenStatus(
              critique
                ? `Designing ${i + 1} of ${iterationCount} (with feedback)…`
                : `Designing ${i + 1} of ${iterationCount}…`
            );

            // Create this frame's placeholder NOW (not upfront)
            addPlaceholder(iterId, i, pos);

            try {
              const result = await runPipelineForFrame(
                iterId,
                prompt,
                concepts[i] || VARIATION_STYLES[i % VARIATION_STYLES.length],
                i,
                critique,
                controller.signal,
              );

              // Update position to use actual dimensions for layout
              setGroups((prev) =>
                prev.map((g) => {
                  if (g.id !== groupId) return g;
                  return {
                    ...g,
                    iterations: g.iterations.map((iter) => {
                      if (iter.id !== iterId) return iter;
                      return { ...iter, position: pos };
                    }),
                  };
                })
              );

              completeFrame(iterId, result, pos);
              critique = result.critique;
            } catch (err) {
              if (err instanceof Error && err.name === "AbortError") throw err;
              const msg = err instanceof Error ? err.message : "Failed";
              setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "error", progress: 0 } }));
              completeFrame(iterId, {
                html: `<div style="padding:32px;color:#666;font-family:system-ui"><p style="font-size:14px">⚠ ${msg}</p></div>`,
                label: `Variation ${i + 1}`,
              }, pos);
            }
          }
        }

      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              const kept = g.iterations.filter((iter) => !iter.isLoading);
              const removedIds = g.iterations.filter((iter) => iter.isLoading).map((iter) => iter.id);
              if (removedIds.length) {
                setPipelineStages((prev) => {
                  const next = { ...prev };
                  removedIds.forEach((id) => delete next[id]);
                  return next;
                });
              }
              return { ...g, iterations: kept };
            }).filter((g) => g.iterations.length > 0)
          );
        } else {
          const msg = err instanceof Error ? err.message : "Generation failed";
          console.error("Generation failed:", msg);
          setGroups((prev) =>
            prev.map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                iterations: g.iterations.map((iter) => {
                  if (!iter.isLoading) return iter;
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
        setGenStatus("");
      }
    },
    [getGridPositions, settings, canvas, quickMode, runPipelineForFrame]
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
      setPipelineStages((prev) => ({ ...prev, [remixId]: { stage: "layout", progress: 0.2 } }));

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const result = await runPipelineForFrame(
          remixId,
          sourceIteration.prompt || "",
          "remix",
          0,
          undefined,
          controller.signal,
          { revision: remixPrompt, existingHtml: sourceIteration.html },
        );

        setPipelineStages((prev) => ({ ...prev, [remixId]: { stage: "done", progress: 1 } }));
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== newGroup.id) return g;
            return {
              ...g,
              iterations: [{
                ...placeholder,
                html: result.html || "<p>Remix failed</p>",
                label: result.label || "Remix",
                width: result.width || placeholder.width,
                height: result.height || placeholder.height,
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

      const commentId = `comment-${Date.now()}`;
      const newComment: CommentType = {
        id: commentId,
        position: commentDraft.position,
        text,
        number: commentCountRef.current,
        createdAt: Date.now(),
        status: "waiting",
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

      const updateComment = (iterId: string, cId: string, update: Partial<CommentType>) => {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            iterations: g.iterations.map((iter) => {
              if (iter.id !== iterId) return iter;
              return {
                ...iter,
                comments: iter.comments.map((c) =>
                  c.id === cId ? { ...c, ...update } : c
                ),
              };
            }),
          }))
        );
      };

      // Trigger revision
      if (targetIteration) {
        const iterId = commentDraft.iterationId;

        // Mark comment as working
        updateComment(iterId, commentId, { status: "working" });
        setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "layout", progress: 0.2 } }));

        try {
          const controller = new AbortController();
          const typedTarget = targetIteration as DesignIteration;

          let result;
          try {
            result = await runPipelineForFrame(
              iterId,
              typedTarget.prompt || "",
              "revision",
              0,
              undefined,
              controller.signal,
              { revision: text, existingHtml: typedTarget.html },
            );
          } catch (err) {
            console.error("Revision pipeline failed:", err);
            throw err;
          }

          setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "done", progress: 1 } }));

          // Update frame with revised HTML
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              iterations: g.iterations.map((iter) => {
                if (iter.id !== iterId) return iter;
                return {
                  ...iter,
                  html: result.html || iter.html,
                  width: result.width || iter.width,
                  height: result.height || iter.height,
                  isRegenerating: false,
                };
              }),
            }))
          );

          // Mark comment as done with response
          updateComment(iterId, commentId, {
            status: "done",
            aiResponse: `✅ Applied: "${text.length > 60 ? text.slice(0, 60) + "…" : text}"`,
          });

        } catch (err) {
          console.error("Revision failed:", err);
          // ALWAYS reset isRegenerating and pipeline stage on error
          setPipelineStages((prev) => ({ ...prev, [iterId]: { stage: "error", progress: 0 } }));
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              iterations: g.iterations.map((iter) => {
                if (iter.id !== iterId) return iter;
                return { ...iter, isRegenerating: false };
              }),
            }))
          );
          updateComment(iterId, commentId, {
            status: "done",
            aiResponse: `⚠️ Revision failed: ${err instanceof Error ? err.message : "Unknown error"}. Try again.`,
          });
        }
      }
    },
    [commentDraft, runPipelineForFrame]
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
          // Capture start positions for all selected frames (multi-drag)
          dragStartPositions.current.clear();
          const movingIds = selectedIds.has(iterationId) ? selectedIds : new Set([iterationId]);
          for (const g of groups) {
            for (const it of g.iterations) {
              if (movingIds.has(it.id)) {
                dragStartPositions.current.set(it.id, { ...it.position });
              }
            }
          }
          setDraggingId(iterationId);
          break;
        }
      }
    },
    [toolMode, spaceHeld, groups, selectedIds]
  );

  // Store start positions for all selected frames during multi-drag
  const dragStartPositions = useRef<Map<string, Point>>(new Map());

  const handleFrameDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startMouse.x) / canvas.scale;
      const dy = (e.clientY - dragRef.current.startMouse.y) / canvas.scale;

      const dragId = dragRef.current.iterationId;
      const movingIds = selectedIds.has(dragId) ? selectedIds : new Set([dragId]);

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          iterations: g.iterations.map((iter) => {
            if (!movingIds.has(iter.id)) return iter;
            const startPos = dragStartPositions.current.get(iter.id) || iter.position;
            return { ...iter, position: { x: startPos.x + dx, y: startPos.y + dy } };
          }),
        }))
      );
    },
    [canvas.scale, selectedIds]
  );

  const handleFrameDragEnd = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
  }, []);

  const canPan = spaceHeld && !draggingId;
  const isSelectMode = toolMode === "select" && !spaceHeld;

  const allIterations = groups.flatMap((g) => g.iterations.map((iter) => ({ ...iter, groupId: g.id })));

  return (
    <div className="h-screen w-screen overflow-hidden relative select-none">
      {/* Canvas layer — this is what pans/zooms */}
      <div
        ref={combinedCanvasRef}
        className={`absolute inset-0 canvas-dots ${
          canPan ? "cursor-grab active:cursor-grabbing" : ""
        } ${toolMode === "comment" && !spaceHeld ? "cursor-crosshair" : "cursor-default"}`}
        onMouseDown={(e) => {
          if (canPan) {
            canvas.onMouseDown(e);
            return;
          }
          if (isSelectMode && !draggingId) {
            // Start rubber band selection on empty canvas
            if (!e.shiftKey) setSelectedIds(new Set());
            setRubberBand({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
          }
        }}
        onMouseMove={(e) => {
          if (draggingId) {
            handleFrameDragMove(e);
          } else if (rubberBand) {
            setRubberBand((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
          } else {
            canvas.onMouseMove(e);
          }
        }}
        onMouseUp={() => {
          if (draggingId) {
            handleFrameDragEnd();
          } else if (rubberBand) {
            // Calculate rubber band rect in canvas coordinates
            const rb = rubberBand;
            const minScreenX = Math.min(rb.startX, rb.currentX);
            const maxScreenX = Math.max(rb.startX, rb.currentX);
            const minScreenY = Math.min(rb.startY, rb.currentY);
            const maxScreenY = Math.max(rb.startY, rb.currentY);

            // Only select if dragged at least 5px (not just a click)
            if (maxScreenX - minScreenX > 5 || maxScreenY - minScreenY > 5) {
              // Convert screen rect to canvas coordinates
              const toCanvasX = (sx: number) => (sx - canvas.offset.x) / canvas.scale;
              const toCanvasY = (sy: number) => (sy - canvas.offset.y) / canvas.scale;
              const canvasMinX = toCanvasX(minScreenX);
              const canvasMaxX = toCanvasX(maxScreenX);
              const canvasMinY = toCanvasY(minScreenY);
              const canvasMaxY = toCanvasY(maxScreenY);

              const newSelected = new Set(selectedIds);
              for (const iter of allIterations) {
                const ix = iter.position.x;
                const iy = iter.position.y;
                const iw = iter.width || FRAME_WIDTH;
                const ih = iter.height || 300;
                // Check overlap
                if (ix + iw > canvasMinX && ix < canvasMaxX && iy + ih > canvasMinY && iy < canvasMaxY) {
                  newSelected.add(iter.id);
                }
              }
              setSelectedIds(newSelected);
            }
            setRubberBand(null);
          } else {
            canvas.onMouseUp();
          }
        }}
        onMouseLeave={() => {
          if (draggingId) { handleFrameDragEnd(); } else { setRubberBand(null); canvas.onMouseUp(); }
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
              isSelected={selectedIds.has(iteration.id)}
              onSelect={(e?: React.MouseEvent) => {
                if (e?.shiftKey) {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(iteration.id)) next.delete(iteration.id);
                    else next.add(iteration.id);
                    return next;
                  });
                } else {
                  setSelectedIds(new Set([iteration.id]));
                }
              }}
              onAddComment={handleAddComment}
              onClickComment={handleClickComment}
              onDragStart={(e) => handleFrameDragStart(iteration.id, e)}
              onRemix={handleRemix}
              scale={canvas.scale}
              apiKey={settings.apiKey || undefined}
              model={settings.model}
              pipelineStatus={pipelineStages[iteration.id]}
            />
          ))}

          {/* Pipeline status overlays */}
          {allIterations.map((iteration) => {
            const status = pipelineStages[iteration.id];
            if (!status || status.stage === "done") return null;
            return (
              <PipelineStatusOverlay
                key={`pipeline-${iteration.id}`}
                status={status}
                x={iteration.position.x}
                y={iteration.position.y}
                width={iteration.width || FRAME_WIDTH}
                frameHeight={iteration.isLoading ? 320 : (iteration.height || 320)}
              />
            );
          })}
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

      {/* Rubber band selection overlay */}
      {rubberBand && (
        <div
          className="fixed pointer-events-none z-[60] border border-blue-400/50 bg-blue-400/10 rounded-sm"
          style={{
            left: Math.min(rubberBand.startX, rubberBand.currentX),
            top: Math.min(rubberBand.startY, rubberBand.currentY),
            width: Math.abs(rubberBand.currentX - rubberBand.startX),
            height: Math.abs(rubberBand.currentY - rubberBand.startY),
          }}
        />
      )}

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
        showZoomControls={settings.showZoomControls}
        onToggleZoomControls={() => setSettings({ showZoomControls: !settings.showZoomControls })}
      />

      <PromptBar onSubmit={handleGenerate} isGenerating={isGenerating} genStatus={genStatus} onCancel={() => abortRef.current?.abort()} />

      {/* Dev mode build badge */}
      {showGitHash && (
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

      {/* Onboarding: Welcome modal */}
      {onboarding.showWelcome && (
        <OnboardingModal
          onComplete={(keys) => {
            setSettings({
              apiKey: keys.anthropicKey,
              geminiKey: keys.geminiKey,
              unsplashKey: keys.unsplashKey,
              openaiKey: keys.openaiKey,
            });
            onboarding.completeKeys();
          }}
          onDismiss={() => onboarding.dismiss()}
        />
      )}

      {/* Onboarding: Guided tour */}
      {onboarding.showTour && (
        <GuidedTour
          onComplete={() => onboarding.completeTour()}
          hasFrames={groups.length > 0 && groups.some(g => g.iterations.some(i => !i.isLoading && i.html))}
        />
      )}

      {/* Onboarding: Key banner (no API key set and not showing welcome modal) */}
      {onboarding.loaded && !settings.apiKey && !onboarding.showWelcome && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 backdrop-blur-xl border border-amber-300/30 text-[12px] font-medium text-amber-700 hover:bg-amber-500/20 transition-all shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Add your API key in Settings to start designing
          </button>
        </div>
      )}
    </div>
  );
}
