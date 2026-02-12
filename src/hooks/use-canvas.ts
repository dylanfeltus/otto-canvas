"use client";

import { useCallback, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface CanvasState {
  offset: Point;
  scale: number;
}

export function useCanvas() {
  const [state, setState] = useState<CanvasState>({
    offset: { x: 0, y: 0 },
    scale: 1,
  });

  const isPanning = useRef(false);
  const lastMouse = useRef<Point>({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with middle button or when space is held (handled by parent)
    if (e.button === 1 || e.button === 0) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setState((prev) => ({
      ...prev,
      offset: { x: prev.offset.x + dx, y: prev.offset.y + dy },
    }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom — clamped deltaY for smooth, Figma-like feel
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 10);
      const zoomFactor = 1 - delta * 0.008;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setState((prev) => {
        const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.1), 5);
        const scaleChange = newScale / prev.scale;
        return {
          scale: newScale,
          offset: {
            x: mouseX - (mouseX - prev.offset.x) * scaleChange,
            y: mouseY - (mouseY - prev.offset.y) * scaleChange,
          },
        };
      });
    } else {
      // Pan
      setState((prev) => ({
        ...prev,
        offset: {
          x: prev.offset.x - e.deltaX,
          y: prev.offset.y - e.deltaY,
        },
      }));
    }
  }, []);

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number, rect: DOMRect): Point => {
      return {
        x: (screenX - rect.left - state.offset.x) / state.scale,
        y: (screenY - rect.top - state.offset.y) / state.scale,
      };
    },
    [state.offset, state.scale]
  );

  const resetView = useCallback(() => {
    setState({ offset: { x: 0, y: 0 }, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 5),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale * 0.8, 0.1),
    }));
  }, []);

  return {
    offset: state.offset,
    scale: state.scale,
    isPanning,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onWheel,
    screenToCanvas,
    resetView,
    zoomIn,
    zoomOut,
  };
}
