"use client";

import { useState, useCallback, useEffect } from "react";

export interface Settings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "designbuddy-settings";

const DEFAULT_MODEL = "claude-opus-4-20250514";

export const MODELS = [
  { id: "claude-opus-4-20250514", label: "Opus 4", desc: "Best quality, slower" },
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4", desc: "Fast + good" },
] as const;

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>({
    apiKey: "",
    model: DEFAULT_MODEL,
  });
  const [loaded, setLoaded] = useState(false);

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

  return { settings, setSettings, isOwnKey, loaded };
}
