"use client";

import { useState, useCallback, useEffect } from "react";

export interface Settings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "otto-settings";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export const MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6", desc: "Best quality, slowest" },
  { id: "claude-opus-4-5-20250918", label: "Opus 4.5", desc: "Creative + powerful" },
  { id: "claude-sonnet-4-5", label: "Sonnet 4.5", desc: "Fast + great" },
  { id: "claude-opus-4", label: "Opus 4", desc: "High quality, slower" },
  { id: "claude-sonnet-4", label: "Sonnet 4", desc: "Fast, reliable" },
] as const;

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>({
    apiKey: "",
    model: DEFAULT_MODEL,
  });
  const [loaded, setLoaded] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettingsState({
          apiKey: parsed.apiKey || "",
          model: parsed.model || DEFAULT_MODEL,
        });
      }
    } catch {}
    setLoaded(true);
  }, []);

  const setSettings = useCallback((update: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isOwnKey = !!settings.apiKey;

  // All models always available — errors show at generation time
  const availableModels: Record<string, boolean> = {};
  for (const m of MODELS) {
    availableModels[m.id] = true;
  }

  return { settings, setSettings, isOwnKey, loaded, availableModels, isProbing: false };
}
