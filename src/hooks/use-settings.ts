"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface Settings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "designbuddy-settings";
const PROBE_CACHE_KEY = "designbuddy-model-probe";
const DEFAULT_MODEL = "claude-opus-4-20250514";

export const MODELS = [
  { id: "claude-opus-4-20250514", label: "Opus 4", desc: "Best quality, slower" },
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4", desc: "Fast + good" },
] as const;

// Simple hash for cache key
function hashKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

interface ProbeCache {
  keyHash: string;
  available: Record<string, boolean>;
  timestamp: number;
}

function loadProbeCache(): ProbeCache | null {
  try {
    const raw = localStorage.getItem(PROBE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as ProbeCache;
    // Expire after 24h
    if (Date.now() - cache.timestamp > 24 * 60 * 60 * 1000) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveProbeCache(cache: ProbeCache): void {
  try {
    localStorage.setItem(PROBE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>({
    apiKey: "",
    model: DEFAULT_MODEL,
  });
  const [loaded, setLoaded] = useState(false);
  const [availableModels, setAvailableModels] = useState<Record<string, boolean> | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const probeAbort = useRef<AbortController | null>(null);

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

  // Probe models when API key changes
  const probeModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setAvailableModels(null);
      setIsProbing(false);
      return;
    }

    const kh = hashKey(apiKey);

    // Check cache
    const cached = loadProbeCache();
    if (cached && cached.keyHash === kh) {
      setAvailableModels(cached.available);
      return;
    }

    // Abort any in-flight probe
    probeAbort.current?.abort();
    const controller = new AbortController();
    probeAbort.current = controller;

    setIsProbing(true);
    try {
      const res = await fetch("/api/probe-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Probe failed");
      const data = await res.json();

      if (!controller.signal.aborted) {
        setAvailableModels(data.available);
        saveProbeCache({ keyHash: kh, available: data.available, timestamp: Date.now() });

        // If current model isn't available, switch to first available
        const currentAvailable = data.available[settings.model];
        if (!currentAvailable) {
          const firstAvailable = MODELS.find((m) => data.available[m.id]);
          if (firstAvailable) {
            setSettingsState((prev) => {
              const next = { ...prev, model: firstAvailable.id };
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Model probe failed:", err);
    } finally {
      if (!controller.signal.aborted) {
        setIsProbing(false);
      }
    }
  }, [settings.model]);

  // Trigger probe when key changes
  useEffect(() => {
    if (loaded) {
      probeModels(settings.apiKey);
    }
  }, [settings.apiKey, loaded, probeModels]);

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

  return { settings, setSettings, isOwnKey, loaded, availableModels, isProbing };
}
