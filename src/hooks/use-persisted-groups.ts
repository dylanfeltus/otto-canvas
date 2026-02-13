"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GenerationGroup } from "@/lib/types";

const STORAGE_KEY = "otto-canvas-session";

export function usePersistedGroups() {
  const [groups, setGroupsRaw] = useState<GenerationGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GenerationGroup[];
        // Filter out any groups with only loading placeholders (incomplete saves)
        const valid = parsed.filter((g) =>
          g.iterations.some((it) => it.html && !it.isLoading)
        );
        if (valid.length > 0) {
          setGroupsRaw(valid);
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  // Debounced save to localStorage
  const persistGroups = useCallback((newGroups: GenerationGroup[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        // Only save groups that have real content
        const toSave = newGroups.filter((g) =>
          g.iterations.some((it) => it.html && !it.isLoading)
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
    }, 500);
  }, []);

  // Wrapper that persists on every change
  const setGroups = useCallback(
    (updater: GenerationGroup[] | ((prev: GenerationGroup[]) => GenerationGroup[])) => {
      setGroupsRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persistGroups(next);
        return next;
      });
    },
    [persistGroups]
  );

  const resetSession = useCallback(() => {
    setGroupsRaw([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { groups, setGroups, loaded, resetSession };
}
