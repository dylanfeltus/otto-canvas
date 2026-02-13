"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  waitForGeneration?: boolean; // pause until first frame appears
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "prompt-bar",
    title: "Describe your design",
    description: "Type any design — a landing page, Instagram ad, app screen. Be specific about colors, style, and content.",
    placement: "top",
  },
  {
    target: "prompt-bar",
    title: "Generate",
    description: "Hit Enter or click Generate. Otto creates multiple variations, each one learning from the last.",
    placement: "top",
  },
  {
    target: "design-frame",
    title: "Your designs",
    description: "Each frame is a polished HTML/CSS design. Pan and zoom the canvas to explore.",
    placement: "right",
    waitForGeneration: true,
  },
  {
    target: "remix-button",
    title: "Remix",
    description: "Want a different take? Remix any frame with a new direction.",
    placement: "bottom",
    waitForGeneration: true,
  },
  {
    target: "comment-tool",
    title: "Click-to-Comment",
    description: "Click anywhere on a design to leave feedback. Otto will revise just that part.",
    placement: "right",
  },
  {
    target: "export-menu",
    title: "Export",
    description: "Export to Figma, Tailwind CSS, or React components.",
    placement: "bottom",
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  hasFrames: boolean; // whether at least one generated frame exists
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour({ onComplete, hasFrames }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const rafRef = useRef<number>(0);

  const currentStep = TOUR_STEPS[step];

  // Find and track the target element
  const updateRect = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
    rafRef.current = requestAnimationFrame(updateRect);
  }, [currentStep]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateRect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateRect]);

  // Handle waitForGeneration steps
  useEffect(() => {
    if (currentStep?.waitForGeneration && !hasFrames) {
      setWaiting(true);
    } else {
      setWaiting(false);
    }
  }, [currentStep, hasFrames]);

  const next = () => {
    if (step + 1 >= TOUR_STEPS.length) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  if (!currentStep) return null;
  if (waiting) {
    // Show a subtle "waiting for generation" message
    return (
      <div className="fixed inset-0 z-[75] pointer-events-none flex items-end justify-center pb-36">
        <div className="pointer-events-auto bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] px-5 py-3 text-center">
          <p className="text-[13px] text-gray-600 font-medium">✨ Generate your first design to continue the tour</p>
          <button
            onClick={onComplete}
            className="mt-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    );
  }

  // Tooltip positioning
  const pad = 12;
  const placement = currentStep.placement || "bottom";
  let tooltipStyle: React.CSSProperties = {};
  if (rect) {
    switch (placement) {
      case "top":
        tooltipStyle = { left: rect.left + rect.width / 2, top: rect.top - pad, transform: "translate(-50%, -100%)" };
        break;
      case "bottom":
        tooltipStyle = { left: rect.left + rect.width / 2, top: rect.top + rect.height + pad, transform: "translate(-50%, 0)" };
        break;
      case "left":
        tooltipStyle = { left: rect.left - pad, top: rect.top + rect.height / 2, transform: "translate(-100%, -50%)" };
        break;
      case "right":
        tooltipStyle = { left: rect.left + rect.width + pad, top: rect.top + rect.height / 2, transform: "translate(0, -50%)" };
        break;
    }
  }

  return (
    <>
      {/* SVG spotlight overlay */}
      <svg className="fixed inset-0 z-[74] pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring */}
      {rect && (
        <div
          className="fixed z-[75] pointer-events-none rounded-xl border-2 border-violet-400/60 shadow-[0_0_0_4px_rgba(139,92,246,0.15)]"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          className="fixed z-[76] w-[280px]"
          style={tooltipStyle}
        >
          <div className="bg-white/80 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">
                Step {step + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <h3 className="text-[14px] font-semibold text-gray-800 mb-1">{currentStep.title}</h3>
            <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{currentStep.description}</p>
            <div className="flex items-center justify-between">
              <button
                onClick={onComplete}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip tour
              </button>
              <button
                onClick={next}
                className="text-[12px] font-semibold text-white bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                {step + 1 >= TOUR_STEPS.length ? "Done" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
